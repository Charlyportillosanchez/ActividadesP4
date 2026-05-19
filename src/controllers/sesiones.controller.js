let sesiones = [];
let nextId = 1;

exports.getAll = (req, res) => {
  res.status(200).json(sesiones);
};

exports.getById = (req, res) => {
  const sesion = sesiones.find(s => s.id === parseInt(req.params.id));
  if (!sesion) return res.status(404).json({ error: 'Sesión no encontrada' });
  res.status(200).json(sesion);
};

exports.create = (req, res) => {
  const { tema, materia, fecha } = req.body;
  if (!tema) return res.status(400).json({ error: 'El campo "tema" es obligatorio' });
  if (!materia) return res.status(400).json({ error: 'El campo "materia" es obligatorio' });
  if (!fecha) return res.status(400).json({ error: 'El campo "fecha" es obligatorio' });

  const nueva = { id: nextId++, tema, materia, fecha };
  sesiones.push(nueva);
  res.status(201).json(nueva);
};

exports.update = (req, res) => {
  const index = sesiones.findIndex(s => s.id === parseInt(req.params.id));
  if (index === -1) return res.status(404).json({ error: 'Sesión no encontrada' });

  sesiones[index] = { id: parseInt(req.params.id), ...req.body };
  res.status(200).json(sesiones[index]);
};

exports.remove = (req, res) => {
  const index = sesiones.findIndex(s => s.id === parseInt(req.params.id));
  if (index === -1) return res.status(404).json({ error: 'Sesión no encontrada' });

  sesiones.splice(index, 1);
  res.status(200).json({ mensaje: 'Sesión eliminada correctamente' });
};