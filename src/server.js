const express = require('express');
const dotenv = require('dotenv');
dotenv.config();

const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger/config');

const app = express();
app.use(express.json());

const sesionesRoutes = require('./routes/sesiones.routes');
const authRoutes = require('./routes/auth');

app.use('/api/sesiones', sesionesRoutes);
app.use('/auth', authRoutes);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});

require('./subscribers/notificaciones');

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));