const supabase = require('../db');
const { pub } = require('../redis/client');

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

  // Contamos los espacios ocupados por garaje a partir de las reservas activas.
  // Así cualquier usuario (cliente o propietario) ve la disponibilidad real
  // sin exponer datos privados de las reservas.
  const { data: reservas } = await supabase
    .from('reservas').select('*').eq('estado', 'activa');

  const ocupadosPorGaraje = {};
  (reservas || []).forEach((r) => {
    const esp = Number(r.espacios) > 0 ? Number(r.espacios) : 1;
    ocupadosPorGaraje[r.garaje_id] = (ocupadosPorGaraje[r.garaje_id] || 0) + esp;
  });

  const resultado = garajes.map((g) => {
    const capacidad = Number(g.capacidad) > 0 ? Number(g.capacidad) : 1;
    const ocupados = Math.min(ocupadosPorGaraje[g.id] || 0, capacidad);
    return { ...g, capacidad, ocupados, disponible: ocupados < capacidad };
  });

  res.status(200).json(resultado);
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