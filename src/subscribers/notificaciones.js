const { sub } = require('../redis/client');

sub.subscribe('study:sesion:creada', 'study:sesion:eliminada', (err, count) => {
  if (err) console.error('Error al suscribirse:', err);
  else console.log(`Suscrito a ${count} canales de Redis`);
});

sub.on('message', (channel, message) => {
  console.log(`[Redis] Canal: ${channel} | Mensaje: ${message}`);
});