const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../db');

// REGISTRO
router.post('/register', async (req, res) => {
  const { nombre, email, password } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El campo "nombre" es obligatorio' });
  if (!email) return res.status(400).json({ error: 'El campo "email" es obligatorio' });
  if (!password) return res.status(400).json({ error: 'El campo "password" es obligatorio' });

  const hash = await bcrypt.hash(password, 10);

  const { data, error } = await supabase
    .from('usuarios')
    .insert([{ nombre, email, password: hash }])
    .select();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ mensaje: 'Usuario registrado', usuario: data[0] });
});

// LOGIN
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email y password requeridos' });

  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('email', email)
    .single();

  if (error || !data) return res.status(401).json({ error: 'Credenciales inválidas' });

  const valido = await bcrypt.compare(password, data.password);
  if (!valido) return res.status(401).json({ error: 'Credenciales inválidas' });

  const token = jwt.sign(
    { id: data.id, email: data.email },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.status(200).json({ token });
});

module.exports = router;