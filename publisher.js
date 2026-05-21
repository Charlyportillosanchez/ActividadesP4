require('dotenv').config();
const Redis = require('ioredis');

const pub = new Redis(process.env.REDIS_URL);

const publicar = async (canal, tipo, payload) => {
  const mensaje = {
    tipo,
    payload,
    timestamp: new Date().toISOString(),
    version: '1.0'
  };
  await pub.publish(canal, JSON.stringify(mensaje));
  console.log(`[Publisher] Canal: ${canal} | Tipo: ${tipo}`);
  console.log(JSON.stringify(mensaje, null, 2));
};

// Publicar eventos de prueba
const demo = async () => {
  console.log('🚀 Publicador iniciado...\n');

  await publicar('study:sesion:creada', 'SESION_CREADA', {
    id: 1,
    tema: 'Repaso de estructuras de datos',
    materia: 'Programación IV',
    fecha: '2026-05-21',
    usuario: 'Charly Portillo'
  });

  await new Promise(r => setTimeout(r, 2000));

  await publicar('study:usuario:unido', 'USUARIO_UNIDO', {
    usuario: 'María García',
    grupo: 'Programación IV - Grupo A',
    hora: new Date().toISOString()
  });

  await new Promise(r => setTimeout(r, 2000));

  await publicar('study:sesion:creada', 'SESION_CREADA', {
    id: 2,
    tema: 'Algoritmos de ordenamiento',
    materia: 'Estructura de Datos',
    fecha: '2026-05-21',
    usuario: 'Carlos Mendez'
  });

  console.log('\n✅ Demo completada');
  process.exit(0);
};

demo();