const supabase = require('../db');
const { pub } = require('../redis/client');

exports.getAll = async (req, res) => {
  const { data, error } = await supabase.from('sesiones').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json(data);
};

exports.getById = async (req, res) => {
  const { data, error } = await supabase
    .from('sesiones')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (error) return res.status(404).json({ error: 'Sesión no encontrada' });
  res.status(200).json(data);
};

exports.create = async (req, res) => {
  const { tema, materia, fecha } = req.body;
  if (!tema) return res.status(400).json({ error: 'El campo "tema" es obligatorio' });
  if (!materia) return res.status(400).json({ error: 'El campo "materia" es obligatorio' });
  if (!fecha) return res.status(400).json({ error: 'El campo "fecha" es obligatorio' });

  const { data, error } = await supabase
    .from('sesiones')
    .insert([{ tema, materia, fecha, usuario_id: req.usuario.id }])
    .select();
  if (error) return res.status(500).json({ error: error.message });

  await pub.publish('study:sesion:creada', JSON.stringify(data[0]));

  res.status(201).json(data[0]);
};

exports.update = async (req, res) => {
  const { data, error } = await supabase
    .from('sesiones')
    .update(req.body)
    .eq('id', req.params.id)
    .select();
  if (error || !data.length) return res.status(404).json({ error: 'Sesión no encontrada' });
  res.status(200).json(data[0]);
};

exports.remove = async (req, res) => {
  const { error } = await supabase
    .from('sesiones')
    .delete()
    .eq('id', req.params.id);
  if (error) return res.status(404).json({ error: 'Sesión no encontrada' });

  await pub.publish('study:sesion:eliminada', JSON.stringify({ id: req.params.id }));

  res.status(200).json({ mensaje: 'Sesión eliminada correctamente' });
};