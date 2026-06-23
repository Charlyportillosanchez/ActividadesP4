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

  const espacios = Number(req.body.espacios) > 0 ? Number(req.body.espacios) : 1;

  const { data: garaje, error: garajeError } = await supabase
    .from('garajes').select('*').eq('id', garaje_id).single();
  if (garajeError) return res.status(404).json({ error: 'Garaje no encontrado' });

  // Calculamos cuántos espacios siguen ocupados por reservas activas y
  // verificamos que haya cupo suficiente para los espacios solicitados.
  const capacidad = Number(garaje.capacidad) > 0 ? Number(garaje.capacidad) : 1;
  const { data: activas } = await supabase
    .from('reservas').select('*').eq('garaje_id', garaje_id).eq('estado', 'activa');
  const ocupados = (activas || []).reduce(
    (suma, r) => suma + (Number(r.espacios) > 0 ? Number(r.espacios) : 1), 0);

  if (ocupados + espacios > capacidad) {
    const libres = Math.max(capacidad - ocupados, 0);
    return res.status(400).json({
      error: libres === 0
        ? 'El garaje no tiene espacios disponibles'
        : `Solo quedan ${libres} espacio(s) disponible(s)`
    });
  }

  const total = garaje.precio_hora * horas * espacios;

  const { data, error } = await supabase
    .from('reservas')
    .insert([{ garaje_id, usuario_id: req.usuario.id, horas, espacios, total }])
    .select();
  if (error) return res.status(500).json({ error: error.message });

  // El garaje deja de estar disponible solo cuando se llena por completo.
  const disponible = (ocupados + espacios) < capacidad;
  await supabase.from('garajes').update({ disponible }).eq('id', garaje_id);

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

// Reservas recibidas en los garajes del propietario autenticado.
exports.getRecibidas = async (req, res) => {
  const { data: misGarajes, error: garajesError } = await supabase
    .from('garajes').select('id').eq('usuario_id', req.usuario.id);
  if (garajesError) return res.status(500).json({ error: garajesError.message });

  const ids = (misGarajes || []).map((g) => g.id);
  if (ids.length === 0) return res.status(200).json([]);

  const { data, error } = await supabase
    .from('reservas')
    .select('*, garajes(*)')
    .in('garaje_id', ids);
  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json(data);
};