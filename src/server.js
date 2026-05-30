const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
dotenv.config();

const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger/config');

const app = express();

// Seguridad con Helmet
app.use(helmet());

// Rate Limiting - 100 peticiones por 15 minutos
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Demasiadas peticiones, intenta en 15 minutos' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// CORS
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://actividadesp4.onrender.com',
    'https://timely-klepon-d2c121.netlify.app',
    'https://admirable-dango-13a1f3.netlify.app'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

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