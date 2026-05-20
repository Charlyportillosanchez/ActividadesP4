const express = require('express');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
app.use(express.json());

const sesionesRoutes = require('./routes/sesiones.routes');
const authRoutes = require('./routes/auth');

app.use('/api/sesiones', sesionesRoutes);
app.use('/auth', authRoutes);

app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));