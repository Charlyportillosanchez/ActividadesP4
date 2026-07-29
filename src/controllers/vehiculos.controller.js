const supabase = require('../db');
const { subirImagen } = require('../utils/storage');

// Cuánto espacio ocupa cada tipo de vehículo (en "espacios de auto chico").
// Es la regla que pidió el docente: un camión ocupa varios autos.
const FACTOR_POR_TIPO = {
  moto: 1,
  auto: 1,
  camioneta: 2,
  vagoneta: 2,
  minibus: 3,
  camion: 3,
};

function factorDeTipo(tipo) {
  return FACTOR_POR_TIPO[String(tipo || '').toLowerCase()] || 1;
}

// Registrar un vehículo con datos completos. Queda 'pendiente' hasta que
// el administrador lo apruebe.
exports.crear = async (req, res) => {
  const { placa, chasis, tipo, marca, modelo, color, foto_url,
    asientos, estado_vehiculo, dueno_nombre } = req.body;

  if (!placa || !String(placa).trim()) {
    return res.status(400).json({ error: 'La placa es obligatoria' });
  }
  if (!chasis || !String(chasis).trim()) {
    return res.status(400).json({ error: 'El número de chasis es obligatorio' });
  }
  const tipoNorm = String(tipo || '').toLowerCase();
  if (!FACTOR_POR_TIPO[tipoNorm]) {
    return res.status(400).json({ error: 'El tipo debe ser: auto, camioneta o camion' });
  }

  // Evitar placas duplicadas del mismo usuario.
  const { data: existente } = await supabase
    .from('vehiculos')
    .select('id')
    .eq('usuario_id', req.usuario.id)
    .eq('placa', String(placa).trim().toUpperCase())
    .maybeSingle();
  if (existente) {
    return res.status(400).json({ error: 'Ya registraste un vehículo con esa placa' });
  }

  const registro = {
    usuario_id: req.usuario.id,
    placa: String(placa).trim().toUpperCase(),
    chasis: String(chasis).trim().toUpperCase(),
    tipo: tipoNorm,
    factor_espacio: factorDeTipo(tipoNorm),
    marca: marca ? String(marca).trim() : null,
    modelo: modelo ? String(modelo).trim() : null,
    color: color ? String(color).trim() : null,
    foto_url: foto_url || null,
    estado: 'pendiente',
    asientos: Number(asientos) > 0 ? Number(asientos) : null,
    estado_vehiculo: ['bueno', 'regular', 'malo'].includes(estado_vehiculo)
      ? estado_vehiculo : null,
    dueno_nombre: dueno_nombre ? String(dueno_nombre).trim() : null,
  };

  // Insertamos con los campos nuevos; si la base aún no los tiene (migración
  // pendiente), reintentamos con lo básico.
  let { data, error } = await supabase.from('vehiculos').insert([registro]).select();
  if (error && /asientos|estado_vehiculo|dueno_nombre/.test(error.message || '')) {
    const basico = { ...registro };
    delete basico.asientos;
    delete basico.estado_vehiculo;
    delete basico.dueno_nombre;
    ({ data, error } = await supabase.from('vehiculos').insert([basico]).select());
  }
  if (error) return res.status(500).json({ error: error.message });

  res.status(201).json({
    mensaje: 'Vehículo registrado. Queda pendiente de aprobación.',
    vehiculo: data[0],
  });
};

// Mis vehículos (del usuario autenticado).
exports.mios = async (req, res) => {
  const { data, error } = await supabase
    .from('vehiculos')
    .select('*')
    .eq('usuario_id', req.usuario.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json(data);
};

// Subir la tarjeta de propiedad del vehículo (foto). Solo el dueño.
exports.subirDocumento = async (req, res) => {
  const { data: veh } = await supabase
    .from('vehiculos').select('usuario_id').eq('id', req.params.id).single();
  if (!veh) return res.status(404).json({ error: 'Vehículo no encontrado' });
  if (veh.usuario_id !== req.usuario.id) {
    return res.status(403).json({ error: 'Ese vehículo no es tuyo' });
  }

  const subida = await subirImagen('documentos',
    `vehiculo_${req.params.id}_propiedad`, req.body.imagen, req.body.extension);
  if (subida.error) return res.status(400).json({ error: subida.error });

  const { error } = await supabase
    .from('vehiculos').update({ doc_propiedad: subida.url }).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });

  res.status(201).json({ mensaje: 'Documento subido', url: subida.url });
};

// Eliminar un vehículo propio.
exports.eliminar = async (req, res) => {
  const { data: veh } = await supabase
    .from('vehiculos').select('usuario_id').eq('id', req.params.id).single();
  if (!veh) return res.status(404).json({ error: 'Vehículo no encontrado' });
  if (veh.usuario_id !== req.usuario.id && req.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'No puedes eliminar este vehículo' });
  }
  const { error } = await supabase.from('vehiculos').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ mensaje: 'Vehículo eliminado' });
};

// --- Administración (solo admin) ---

// Vehículos pendientes de aprobación.
exports.pendientes = async (req, res) => {
  if (req.usuario.rol !== 'admin') return res.status(403).json({ error: 'No autorizado' });
  const { data, error } = await supabase
    .from('vehiculos')
    .select('*, usuarios(nombre, email)')
    .eq('estado', 'pendiente')
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json(data);
};

// Aprobar o rechazar un vehículo.
exports.revisar = async (req, res) => {
  if (req.usuario.rol !== 'admin') return res.status(403).json({ error: 'No autorizado' });
  const { aprobar } = req.body;
  const nuevoEstado = aprobar ? 'aprobado' : 'rechazado';

  const { data, error } = await supabase
    .from('vehiculos')
    .update({ estado: nuevoEstado })
    .eq('id', req.params.id)
    .select();
  if (error || !data.length) return res.status(404).json({ error: 'Vehículo no encontrado' });
  res.status(200).json({ mensaje: `Vehículo ${nuevoEstado}`, vehiculo: data[0] });
};
