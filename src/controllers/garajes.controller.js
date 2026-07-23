const supabase = require('../db');
const { pub } = require('../redis/client');
const { reservaOcupaAhora, espaciosDe } = require('../utils/ocupacion');

// Verifica que el usuario autenticado sea el dueño del garaje (o admin).
// Devuelve el garaje si tiene permiso, o null si no.
async function garajeDelUsuario(garajeId, usuario) {
  const { data, error } = await supabase
    .from('garajes').select('*').eq('id', garajeId).single();
  if (error || !data) return { garaje: null, status: 404, mensaje: 'Garaje no encontrado' };
  if (data.usuario_id !== usuario.id && usuario.rol !== 'admin') {
    return { garaje: null, status: 403, mensaje: 'No tienes permiso sobre este garaje' };
  }
  return { garaje: data };
}

exports.getAll = async (req, res) => {
  const { data: garajes, error } = await supabase.from('garajes').select('*');
  if (error) return res.status(500).json({ error: error.message });

  // Contamos los espacios ocupados por garaje a partir de las reservas
  // activas vigentes EN ESTE MOMENTO (las reservas para más tarde no
  // ocupan espacio ahora). Así cualquier usuario ve la disponibilidad real.
  const { data: reservas } = await supabase
    .from('reservas').select('*').eq('estado', 'activa');

  const ocupadosPorGaraje = {};
  (reservas || []).forEach((r) => {
    if (!reservaOcupaAhora(r)) return;
    ocupadosPorGaraje[r.garaje_id] = (ocupadosPorGaraje[r.garaje_id] || 0) + espaciosDe(r);
  });

  // Promedio y cantidad de calificaciones por garaje.
  // Si la tabla aún no existe (migración pendiente), seguimos sin estrellas.
  const notasPorGaraje = {};
  const { data: notas } = await supabase
    .from('calificaciones').select('garaje_id, estrellas');
  (notas || []).forEach((n) => {
    const acc = notasPorGaraje[n.garaje_id] || { suma: 0, cantidad: 0 };
    acc.suma += Number(n.estrellas) || 0;
    acc.cantidad += 1;
    notasPorGaraje[n.garaje_id] = acc;
  });

  const resultado = garajes.map((g) => {
    const capacidad = Number(g.capacidad) > 0 ? Number(g.capacidad) : 1;
    const ocupados = Math.min(ocupadosPorGaraje[g.id] || 0, capacidad);
    const nota = notasPorGaraje[g.id];
    return {
      ...g,
      capacidad,
      ocupados,
      disponible: ocupados < capacidad,
      calificacion: nota ? Math.round((nota.suma / nota.cantidad) * 10) / 10 : null,
      total_calificaciones: nota ? nota.cantidad : 0,
    };
  });

  res.status(200).json(resultado);
};

// Calificar un garaje (1 a 5 estrellas, comentario opcional).
// Si el usuario ya lo calificó antes, se actualiza su nota.
exports.calificar = async (req, res) => {
  const { estrellas, comentario } = req.body;
  const valor = Number(estrellas);
  if (!valor || valor < 1 || valor > 5) {
    return res.status(400).json({ error: 'Las estrellas deben ser un número entre 1 y 5' });
  }

  const { data: garaje, error: garajeError } = await supabase
    .from('garajes').select('id, usuario_id').eq('id', req.params.id).single();
  if (garajeError || !garaje) return res.status(404).json({ error: 'Garaje no encontrado' });
  if (garaje.usuario_id === req.usuario.id) {
    return res.status(400).json({ error: 'No puedes calificar tu propio garaje' });
  }

  const { data, error } = await supabase
    .from('calificaciones')
    .upsert(
      [{
        garaje_id: garaje.id,
        usuario_id: req.usuario.id,
        estrellas: Math.round(valor),
        comentario: comentario ? String(comentario).slice(0, 300) : null,
      }],
      { onConflict: 'garaje_id,usuario_id' },
    )
    .select();
  if (error) return res.status(500).json({ error: error.message });

  res.status(201).json({ mensaje: 'Calificación guardada', calificacion: data[0] });
};

// Lista de calificaciones de un garaje (para mostrar reseñas).
exports.calificaciones = async (req, res) => {
  const { data, error } = await supabase
    .from('calificaciones')
    .select('estrellas, comentario, created_at, usuarios(nombre)')
    .eq('garaje_id', req.params.id)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json(data);
};

exports.getById = async (req, res) => {
  const { data, error } = await supabase
    .from('garajes').select('*').eq('id', req.params.id).single();
  if (error) return res.status(404).json({ error: 'Garaje no encontrado' });
  res.status(200).json(data);
};

exports.create = async (req, res) => {
  const { nombre, direccion, anillo, precio_hora, latitud, longitud, capacidad } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El campo "nombre" es obligatorio' });
  if (!direccion) return res.status(400).json({ error: 'El campo "direccion" es obligatorio' });
  if (!anillo) return res.status(400).json({ error: 'El campo "anillo" es obligatorio' });
  if (!precio_hora) return res.status(400).json({ error: 'El campo "precio_hora" es obligatorio' });
  if (isNaN(Number(precio_hora)) || Number(precio_hora) <= 0) {
    return res.status(400).json({ error: 'El campo "precio_hora" debe ser un número mayor a 0' });
  }
  if (latitud !== undefined && isNaN(Number(latitud))) {
    return res.status(400).json({ error: 'La latitud debe ser un número' });
  }
  if (longitud !== undefined && isNaN(Number(longitud))) {
    return res.status(400).json({ error: 'La longitud debe ser un número' });
  }

  const cap = Number(capacidad) > 0 ? Number(capacidad) : 1;

  const { data, error } = await supabase
    .from('garajes')
    .insert([{ nombre, direccion, anillo, precio_hora, latitud, longitud, capacidad: cap, disponible: true, usuario_id: req.usuario.id }])
    .select();
  if (error) return res.status(500).json({ error: error.message });

  await pub.publish('iot:garaje:creado', JSON.stringify({
    tipo: 'GARAJE_CREADO',
    payload: data[0],
    timestamp: new Date().toISOString(),
    version: '1.0'
  }));

  res.status(201).json(data[0]);
};

exports.update = async (req, res) => {
  const permiso = await garajeDelUsuario(req.params.id, req.usuario);
  if (!permiso.garaje) {
    return res.status(permiso.status).json({ error: permiso.mensaje });
  }

  // Solo se permiten actualizar campos conocidos (nunca usuario_id ni id).
  const permitidos = ['nombre', 'direccion', 'anillo', 'precio_hora', 'latitud', 'longitud', 'capacidad', 'disponible'];
  const cambios = {};
  for (const campo of permitidos) {
    if (req.body[campo] !== undefined) cambios[campo] = req.body[campo];
  }
  if (Object.keys(cambios).length === 0) {
    return res.status(400).json({ error: 'No hay campos válidos para actualizar' });
  }

  const { data, error } = await supabase
    .from('garajes').update(cambios).eq('id', req.params.id).select();
  if (error || !data.length) return res.status(404).json({ error: 'Garaje no encontrado' });
  res.status(200).json(data[0]);
};

exports.remove = async (req, res) => {
  const permiso = await garajeDelUsuario(req.params.id, req.usuario);
  if (!permiso.garaje) {
    return res.status(permiso.status).json({ error: permiso.mensaje });
  }

  // Primero eliminamos las reservas asociadas al garaje. Si no, la base de
  // datos rechaza el borrado por la llave foránea reservas.garaje_id.
  const { error: reservasError } = await supabase
    .from('reservas').delete().eq('garaje_id', req.params.id);
  if (reservasError) return res.status(500).json({ error: reservasError.message });

  const { error } = await supabase.from('garajes').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ mensaje: 'Garaje eliminado correctamente' });
};