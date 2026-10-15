process.env.JWT_SECRET = 'secreto-de-prueba';

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { crearHandler } = require('../handler');

const AHORA = new Date('2026-10-14T12:00:00Z');
const token = jwt.sign({ id: 2 }, process.env.JWT_SECRET, { expiresIn: '1h' });
const evento = (t) => ({
  httpMethod: 'GET',
  path: '/metricas',
  headers: t ? { Authorization: `Bearer ${t}` } : {},
});

const notasFalsas = async () => [
  { id: 1, estado: 'hecho', creado_en: AHORA, actualizado_en: AHORA, creado_por: 1, creador: 'Admin Demo' },
];

test('sin token responde 401', async () => {
  const h = crearHandler({ usuarioActivo: async () => true, obtenerNotas: notasFalsas });
  const r = await h(evento(null));
  assert.equal(r.statusCode, 401);
});

test('con token inválido responde 401', async () => {
  const h = crearHandler({ usuarioActivo: async () => true, obtenerNotas: notasFalsas });
  const r = await h(evento('token-falso'));
  assert.equal(r.statusCode, 401);
});

test('usuario desactivado responde 403', async () => {
  const h = crearHandler({ usuarioActivo: async () => false, obtenerNotas: notasFalsas });
  const r = await h(evento(token));
  assert.equal(r.statusCode, 403);
});

test('con token válido responde 200 y las métricas calculadas', async () => {
  const h = crearHandler({
    usuarioActivo: async () => true,
    obtenerNotas: notasFalsas,
    ahora: () => AHORA,
  });
  const r = await h(evento(token));
  assert.equal(r.statusCode, 200);
  const cuerpo = JSON.parse(r.body);
  assert.equal(cuerpo.total, 1);
  assert.equal(cuerpo.distribucion.hecho, 1);
});

test('si falla la base de datos responde 500 sin revelar detalles internos', async () => {
  const h = crearHandler({
    usuarioActivo: async () => true,
    obtenerNotas: async () => {
      throw new Error('password authentication failed for user portal_user');
    },
  });
  const r = await h(evento(token));
  assert.equal(r.statusCode, 500);
  assert.ok(!r.body.includes('password'));
  assert.ok(!r.body.includes('portal_user'));
});