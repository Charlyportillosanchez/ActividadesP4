require('dotenv').config();
const Redis = require('ioredis');

const sub = new Redis(process.env.REDIS_URL);

console.log('👂 Suscriptor iniciado, esperando mensajes...\n');

sub.psubscribe('study:*', (err, count) => {
  if (err) console.error('Error:', err);
  else console.log(`✅ Suscrito a ${count} canales con patrón study:*\n`);
});

sub.on('pmessage', (pattern, channel, message) => {
  const datos = JSON.parse(message);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📢 Canal: ${channel}`);
  console.log(`📌 Tipo: ${datos.tipo}`);
  console.log(`⏰ Timestamp: ${datos.timestamp}`);
  console.log(`📦 Payload:`, JSON.stringify(datos.payload, null, 2));
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Lógica de negocio por tipo de evento
  if (datos.tipo === 'SESION_CREADA') {
    console.log(`🔔 NOTIFICACIÓN: Nueva sesión de "${datos.payload.tema}" creada por ${datos.payload.usuario}`);
  } else if (datos.tipo === 'USUARIO_UNIDO') {
    console.log(`🔔 NOTIFICACIÓN: ${datos.payload.usuario} se unió al grupo ${datos.payload.grupo}`);
  }
  console.log();
});