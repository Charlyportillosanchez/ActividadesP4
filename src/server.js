const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
dotenv.config();

const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger/config');

const app = express();
app.use(cors());
app.use(express.json());

const sesionesRoutes = require('./routes/sesiones.routes');
const authRoutes = require('./routes/auth');
const garajesRoutes = require('./routes/garajes.routes');
const reservasRoutes = require('./routes/reservas.routes');

app.get('/', (req, res) => {
  res.json({ 
    mensaje: 'IoTGaraje API funcionando',
    version: '1.0.0',
    docs: '/api-docs'
  });
});

app.use('/api/sesiones', sesionesRoutes);
app.use('/auth', authRoutes);
app.use('/api/garajes', garajesRoutes);
app.use('/api/reservas', reservasRoutes);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});

require('./subscribers/notificaciones');

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));