const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const pool = require('../db');
const app = require('../app');

const PASSWORD_DEMO = 'Demo1234';

// Seguridad: las pruebas borran datos, así que solo corren sobre la base de pruebas
function asegurarBaseDePruebas() {
  const nombre = new URL(process.env.DATABASE_URL).pathname.replace('/', '');
  if (nombre !== 'portal_test') {
    throw new Error(`Las pruebas solo pueden correr sobre portal_test (base actual: ${nombre})`);
  }
}

// Deja la base de pruebas en un estado conocido: 2 usuarios, sin notas ni historial
async function reiniciarBase() {
  asegurarBaseDePruebas();
  await pool.query('TRUNCATE historial, notas, usuarios RESTART IDENTITY CASCADE');
  const hash = await bcrypt.hash(PASSWORD_DEMO, 4); // costo bajo: pruebas más rápidas
  await pool.query(
    `INSERT INTO usuarios (nombre, correo, password_hash, rol) VALUES
     ('Admin Demo', 'admin@demo.com', $1, 'admin'),
     ('Usuario Demo', 'usuario@demo.com', $1, 'usuario')`,
    [hash]
  );
}

async function login(correo, password = PASSWORD_DEMO) {
  const res = await request(app).post('/api/login').send({ correo, password });
  return res.body.token;
}

const conToken = (token) => ({ Authorization: `Bearer ${token}` });

// Crea una nota directamente en la base (sin pasar por la API) para preparar escenarios
async function insertarNota({ titulo, texto = '', estado = 'pendiente', creadoPor = 1 }) {
  const r = await pool.query(
    `INSERT INTO notas (titulo, texto, estado, creado_por, modificado_por)
     VALUES ($1, $2, $3, $4, $4) RETURNING *`,
    [titulo, texto, estado, creadoPor]
  );
  return r.rows[0];
}

function tokenExpirado(id = 2) {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: -10 });
}

module.exports = {
  app, pool, request, PASSWORD_DEMO,
  reiniciarBase, login, conToken, insertarNota, tokenExpirado,
};
