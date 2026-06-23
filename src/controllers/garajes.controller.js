const supabase = require('../db');
const { pub } = require('../redis/client');

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
  const { data, error } = await supabase
    .from('garajes').update(req.body).eq('id', req.params.id).select();
  if (error || !data.length) return res.status(404).json({ error: 'Garaje no encontrado' });
  res.status(200).json(data[0]);
};

exports.remove = async (req, res) => {
  // Primero eliminamos las reservas asociadas al garaje. Si no, la base de
  // datos rechaza el borrado por la llave foránea reservas.garaje_id.
  const { error: reservasError } = await supabase
    .from('reservas').delete().eq('garaje_id', req.params.id);
  if (reservasError) return res.status(500).json({ error: reservasError.message });

  const { error } = await supabase.from('garajes').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ mensaje: 'Garaje eliminado correctamente' });
};