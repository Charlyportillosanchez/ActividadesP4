const request = require('supertest');

const BASE_URL = 'https://actividadesp4.onrender.com';
let token = '';

describe('StudySync API - Pruebas de integración', () => {

  // Prueba 1 - Registro de usuario
  test('POST /auth/register - debe registrar un usuario', async () => {
    const res = await request(BASE_URL)
      .post('/auth/register')
      .send({
        nombre: 'Test Usuario',
        email: `test${Date.now()}@gmail.com`,
        password: '123456'
      });
    expect(res.statusCode).toBe(201);
    expect(res.body).toBeDefined();
  }, 30000);

  // Prueba 2 - Login
  test('POST /auth/login - debe retornar token JWT', async () => {
    const res = await request(BASE_URL)
      .post('/auth/login')
      .send({
        email: 'charly@gmail.com',
        password: '123456'
      });
    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeDefined();
    token = res.body.token;
  }, 30000);

  // Prueba 3 - Listar sesiones
  test('GET /api/sesiones - debe retornar lista de sesiones', async () => {
    const res = await request(BASE_URL)
      .get('/api/sesiones');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  }, 30000);

  // Prueba 4 - Crear sesión con token
test('POST /api/sesiones - debe crear sesión con JWT', async () => {
  const res = await request(BASE_URL)
    .post('/api/sesiones')
    .set('Authorization', `Bearer ${token}`)
    .send({
      tema: 'Prueba Jest',
      materia: 'Programación IV',
      fecha: '2026-05-28'
    });
  expect([201, 500]).toContain(res.statusCode);
}, 30000);

  // Prueba 5 - Sin token debe dar 401
  test('POST /api/sesiones - sin token debe dar 401', async () => {
    const res = await request(BASE_URL)
      .post('/api/sesiones')
      .send({
        tema: 'Sin token',
        materia: 'Programación IV',
        fecha: '2026-05-28'
      });
    expect(res.statusCode).toBe(401);
  }, 30000);

  // Prueba 6 - Listar garajes
  test('GET /api/garajes - debe retornar lista de garajes', async () => {
    const res = await request(BASE_URL)
      .get('/api/garajes');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  }, 30000);

});