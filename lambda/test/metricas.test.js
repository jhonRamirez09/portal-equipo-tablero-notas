const test = require('node:test');
const assert = require('node:assert/strict');
const { calcularMetricas } = require('../metricas');

const AHORA = new Date('2026-10-14T12:00:00Z');
const hace = (dias) => new Date(AHORA.getTime() - dias * 24 * 60 * 60 * 1000);

function nota(id, estado, creadoHace, actualizadoHace, usuarioId, nombre) {
  return {
    id,
    estado,
    creado_en: hace(creadoHace),
    actualizado_en: hace(actualizadoHace),
    creado_por: usuarioId,
    creador: nombre,
  };
}

const NOTAS = [
  nota(1, 'pendiente', 1, 1, 1, 'Admin Demo'),
  nota(2, 'pendiente', 10, 2, 2, 'Usuario Demo'),
  nota(3, 'en_curso', 20, 15, 1, 'Admin Demo'),
  nota(4, 'hecho', 3, 3, 1, 'Admin Demo'),
];

test('calcula el total y la distribución con porcentajes por estado', () => {
  const m = calcularMetricas(NOTAS, AHORA);
  assert.equal(m.total, 4);
  assert.deepEqual(m.distribucion, { pendiente: 2, en_curso: 1, hecho: 1 });
  assert.deepEqual(m.porcentajes, { pendiente: 50, en_curso: 25, hecho: 25 });
});

test('cuenta las notas creadas y modificadas en los últimos 7 días', () => {
  const m = calcularMetricas(NOTAS, AHORA);
  assert.equal(m.ultimos_7_dias.creadas, 2);     // notas 1 y 4
  assert.equal(m.ultimos_7_dias.modificadas, 3); // notas 1, 2 y 4
});

test('cuenta las notas creadas por usuario, de mayor a menor', () => {
  const m = calcularMetricas(NOTAS, AHORA);
  assert.deepEqual(m.notas_por_usuario, [
    { usuario_id: 1, nombre: 'Admin Demo', cantidad: 3 },
    { usuario_id: 2, nombre: 'Usuario Demo', cantidad: 1 },
  ]);
});

test('incluye la fecha y hora de la última actualización', () => {
  const m = calcularMetricas(NOTAS, AHORA);
  assert.equal(m.ultima_actualizacion, '2026-10-14T12:00:00.000Z');
});

test('sin notas devuelve ceros y no genera NaN', () => {
  const m = calcularMetricas([], AHORA);
  assert.equal(m.total, 0);
  assert.deepEqual(m.porcentajes, { pendiente: 0, en_curso: 0, hecho: 0 });
  assert.deepEqual(m.notas_por_usuario, []);
});