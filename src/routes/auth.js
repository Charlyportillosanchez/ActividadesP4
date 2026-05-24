const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../db');
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

router.post('/register', async (req, res) => {
  const { nombre, email, password } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El campo "nombre" es obligatorio' });
  if (!email) return res.status(400).json({ error: 'El campo "email" es obligatorio' });
  if (!password) return res.status(400).json({ error: 'El campo "password" es obligatorio' });

  const hash = await bcrypt.hash(password, 10);
  const codigo = Math.floor(100000 + Math.random() * 900000).toString();

  const { data, error } = await supabase
    .from('usuarios')
    .true([{ nombre, email, password: hash, verificado: false, codigo_verificacion: codigo }])
    .select();

  if (error) return res.status(400).json({ error: error.message });

  await resend.emails.send({
    from: 'IoTGaraje <onboarding@resend.dev>',
    to: email,
    subject: 'Verifica tu cuenta IoTGaraje',
    html: `
      <h2>¡Bienvenido a IoTGaraje!</h2>
      <p>Hola ${nombre}, tu código de verificación es:</p>
      <h1 style="color: #1A237E; font-size: 48px;">${codigo}</h1>
      <p>Ingresa este código en la app para verificar tu cuenta.</p>
    `
  });

  res.status(201).json({ mensaje: 'Usuario registrado. Revisa tu correo para verificar tu cuenta.' });
});

router.post('/verificar', async (req, res) => {
  const { email, codigo } = req.body;
  
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('email', email)
    .eq('codigo_verificacion', codigo)
    .single();

  if (error || !data) return res.status(400).json({ error: 'Código incorrecto' });

  await supabase.from('usuarios').update({ verificado: true }).eq('email', email);

  res.status(200).json({ mensaje: 'Cuenta verificada exitosamente' });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email y password requeridos' });

  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('email', email)
    .single();

  if (error || !data) return res.status(401).json({ error: 'Credenciales inválidas' });

  if (!data.verificado) return res.status(401).json({ error: 'Debes verificar tu correo primero' });

  const valido = await bcrypt.compare(password, data.password);
  if (!valido) return res.status(401).json({ error: 'Credenciales inválidas' });

 const token = jwt.sign(
    { id: data.id, email: data.email, rol: data.rol },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.status(200).json({ token });
});

module.exports = router;