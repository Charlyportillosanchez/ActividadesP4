const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../db');
const { Resend } = require('resend');
const { pub } = require('../redis/client');

const resend = new Resend(process.env.RESEND_API_KEY);

// REGISTRO
router.post('/register', async (req, res) => {
  const { nombre, email, password } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El campo "nombre" es obligatorio' });
  if (!email) return res.status(400).json({ error: 'El campo "email" es obligatorio' });
  if (!password) return res.status(400).json({ error: 'El campo "password" es obligatorio' });

  const hash = await bcrypt.hash(password, 10);

  const { data, error } = await supabase
    .from('usuarios')
    .insert([{ nombre, email, password: hash, verificado: true, rol: 'usuario' }])
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
    { id: data.id, email: data.email, rol: data.rol },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  const refreshToken = jwt.sign(
    { id: data.id, email: data.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.status(200).json({ token, refreshToken });
});

// REFRESH TOKEN
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token requerido' });

  try {
    // Verificar si está en blacklist
    const blacklisted = await pub.get(`blacklist:${refreshToken}`);
    if (blacklisted) return res.status(401).json({ error: 'Token inválido' });

    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    
    const { data } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', decoded.id)
      .single();

    const newToken = jwt.sign(
      { id: data.id, email: data.email, rol: data.rol },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).json({ token: newToken });
  } catch (e) {
    res.status(401).json({ error: 'Token expirado, inicia sesión nuevamente' });
  }
});

// LOGOUT - Blacklist en Redis
router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token requerido' });

  // Guardar en blacklist por 7 días
  await pub.setex(`blacklist:${refreshToken}`, 7 * 24 * 60 * 60, 'blacklisted');

  res.status(200).json({ mensaje: 'Sesión cerrada correctamente' });
});

module.exports = router;