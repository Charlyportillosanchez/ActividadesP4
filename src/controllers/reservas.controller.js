const supabase = require('../db');
const { pub } = require('../redis/client');
const { emitir } = require('../realtime');
const { ocupadosEnVentana, ocupadosAhora } = require('../utils/ocupacion');

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
  if (isNaN(Number(horas)) || Number(horas) <= 0 || Number(horas) > 24) {
    return res.status(400).json({ error: 'El campo "horas" debe ser un número entre 1 y 24' });
  }

  const espacios = Number(req.body.espacios) > 0 ? Number(req.body.espacios) : 1;

  // Horario de la reserva: si el cliente no envía "inicio", empieza ahora.
  const ahora = new Date();
  let inicio = ahora;
  if (req.body.inicio) {
    inicio = new Date(req.body.inicio);
    if (isNaN(inicio.getTime())) {
      return res.status(400).json({ error: 'El campo "inicio" no es una fecha válida' });
    }
    if (inicio.getTime() < ahora.getTime() - 5 * 60 * 1000) {
      return res.status(400).json({ error: 'La reserva no puede empezar en el pasado' });
    }
    if (inicio.getTime() > ahora.getTime() + 30 * 24 * 60 * 60 * 1000) {
      return res.status(400).json({ error: 'La reserva no puede ser con más de 30 días de anticipación' });
    }
  }
  const fin = new Date(inicio.getTime() + Number(horas) * 60 * 60 * 1000);

  const { data: garaje, error: garajeError } = await supabase
    .from('garajes').select('*').eq('id', garaje_id).single();
  if (garajeError) return res.status(404).json({ error: 'Garaje no encontrado' });

  // Verificamos el cupo solo contra las reservas que se cruzan con el
  // horario solicitado (las de otros horarios no estorban).
  const capacidad = Number(garaje.capacidad) > 0 ? Number(garaje.capacidad) : 1;
  const { data: activas } = await supabase
    .from('reservas').select('*').eq('garaje_id', garaje_id).eq('estado', 'activa');
  const ocupados = ocupadosEnVentana(activas, inicio, fin);

  if (ocupados + espacios > capacidad) {
    const libres = Math.max(capacidad - ocupados, 0);
    return res.status(400).json({
      error: libres === 0
        ? 'El garaje no tiene espacios disponibles en ese horario'
        : `Solo quedan ${libres} espacio(s) disponible(s) en ese horario`
    });
  }

  const total = garaje.precio_hora * horas * espacios;

  // Insertamos con horario; si la base aún no tiene las columnas
  // inicio/fin (migración pendiente), reintentamos sin ellas.
  let insercion = await supabase
    .from('reservas')
    .insert([{
      garaje_id,
      usuario_id: req.usuario.id,
      horas,
      espacios,
      total,
      inicio: inicio.toISOString(),
      fin: fin.toISOString(),
    }])
    .select();
  if (insercion.error && /inicio|fin/.test(insercion.error.message || '')) {
    insercion = await supabase
      .from('reservas')
      .insert([{ garaje_id, usuario_id: req.usuario.id, horas, espacios, total }])
      .select();
  }
  const { data, error } = insercion;
  if (error) return res.status(500).json({ error: error.message });

  // Disponibilidad mostrada en el mapa: según la ocupación de ahora mismo.
  const disponible = ocupadosAhora([...(activas || []), data[0]]) < capacidad;
  await supabase.from('garajes').update({ disponible }).eq('id', garaje_id);

  await pub.publish('iot:reserva:creada', JSON.stringify({
    tipo: 'RESERVA_CREADA',
    payload: { ...data[0], garaje },
    timestamp: new Date().toISOString(),
    version: '1.0'
  }));

  // Tiempo real: todos los mapas conectados se actualizan al instante.
  emitir('actualizacion', { tipo: 'RESERVA_CREADA', garaje_id });

  res.status(201).json(data[0]);
};

exports.cancelar = async (req, res) => {
  // Solo el dueño de la reserva (o un admin) puede cancelarla.
  const { data: reserva, error: buscarError } = await supabase
    .from('reservas').select('*').eq('id', req.params.id).single();
  if (buscarError || !reserva) return res.status(404).json({ error: 'Reserva no encontrada' });
  if (reserva.usuario_id !== req.usuario.id && req.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'No tienes permiso para cancelar esta reserva' });
  }
  if (reserva.estado === 'cancelada') {
    return res.status(400).json({ error: 'La reserva ya está cancelada' });
  }

  const { data, error } = await supabase
    .from('reservas').update({ estado: 'cancelada' }).eq('id', req.params.id).select();
  if (error || !data.length) return res.status(404).json({ error: 'Reserva no encontrada' });

  // Recalculamos la disponibilidad real del garaje según las reservas
  // que ocupan espacio en este momento.
  const garajeId = data[0].garaje_id;
  const { data: garaje } = await supabase
    .from('garajes').select('capacidad').eq('id', garajeId).single();
  const capacidad = Number(garaje?.capacidad) > 0 ? Number(garaje.capacidad) : 1;
  const { data: activas } = await supabase
    .from('reservas').select('*').eq('garaje_id', garajeId).eq('estado', 'activa');
  await supabase.from('garajes')
    .update({ disponible: ocupadosAhora(activas) < capacidad }).eq('id', garajeId);

  await pub.publish('iot:reserva:cancelada', JSON.stringify({
    tipo: 'RESERVA_CANCELADA',
    payload: data[0],
    timestamp: new Date().toISOString(),
    version: '1.0'
  }));

  emitir('actualizacion', { tipo: 'RESERVA_CANCELADA', garaje_id: garajeId });

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