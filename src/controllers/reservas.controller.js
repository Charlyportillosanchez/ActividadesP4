const supabase = require('../db');
const { pub } = require('../redis/client');

exports.getAll = async (req, res) => {
  const { data, error } = await supabase
    .from('reservas')
    .select('*, garajes(*)')
    .eq('usuario_id', req.usuario.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json(data);
};

exports.create = async (req, res) => {
  const { garaje_id, horas } = req.body;
  if (!garaje_id) return res.status(400).json({ error: 'El campo "garaje_id" es obligatorio' });
  if (!horas) return res.status(400).json({ error: 'El campo "horas" es obligatorio' });

  const { data: garaje, error: garajeError } = await supabase
    .from('garajes').select('*').eq('id', garaje_id).single();
  if (garajeError) return res.status(404).json({ error: 'Garaje no encontrado' });
  if (!garaje.disponible) return res.status(400).json({ error: 'Garaje no disponible' });

  const total = garaje.precio_hora * horas;

  const { data, error } = await supabase
    .from('reservas')
    .insert([{ garaje_id, usuario_id: req.usuario.id, horas, total }])
    .select();
  if (error) return res.status(500).json({ error: error.message });

  await supabase.from('garajes').update({ disponible: false }).eq('id', garaje_id);

  await pub.publish('iot:reserva:creada', JSON.stringify({
    tipo: 'RESERVA_CREADA',
    payload: { ...data[0], garaje },
    timestamp: new Date().toISOString(),
    version: '1.0'
  }));

  res.status(201).json(data[0]);
};

exports.cancelar = async (req, res) => {
  const { data, error } = await supabase
    .from('reservas').update({ estado: 'cancelada' }).eq('id', req.params.id).select();
  if (error || !data.length) return res.status(404).json({ error: 'Reserva no encontrada' });

  await supabase.from('garajes').update({ disponible: true }).eq('id', data[0].garaje_id);

  res.status(200).json({ mensaje: 'Reserva cancelada', reserva: data[0] });
};
exports.getAllAdmin = async (req, res) => {
  if (req.usuario.rol !== 'admin') return res.status(403).json({ error: 'No autorizado' });
  const { data, error } = await supabase
    .from('reservas')
    .select('*, garajes(*)');
  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json(data);
};