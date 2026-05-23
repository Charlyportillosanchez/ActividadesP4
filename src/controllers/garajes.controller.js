const supabase = require('../db');
const { pub } = require('../redis/client');

exports.getAll = async (req, res) => {
  const { data, error } = await supabase.from('garajes').select('*');
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
  const { nombre, direccion, anillo, precio_hora, latitud, longitud } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El campo "nombre" es obligatorio' });
  if (!direccion) return res.status(400).json({ error: 'El campo "direccion" es obligatorio' });
  if (!anillo) return res.status(400).json({ error: 'El campo "anillo" es obligatorio' });
  if (!precio_hora) return res.status(400).json({ error: 'El campo "precio_hora" es obligatorio' });

  const { data, error } = await supabase
    .from('garajes')
    .insert([{ nombre, direccion, anillo, precio_hora, latitud, longitud, usuario_id: req.usuario.id }])
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
  const { error } = await supabase.from('garajes').delete().eq('id', req.params.id);
  if (error) return res.status(404).json({ error: 'Garaje no encontrado' });
  res.status(200).json({ mensaje: 'Garaje eliminado correctamente' });
};