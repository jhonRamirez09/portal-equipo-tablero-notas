// Se ejecuta UNA vez antes de todas las pruebas:
// crea una base de datos aparte (portal_test) con el mismo esquema que db/init.sql,
// así las pruebas nunca tocan los datos reales de la aplicación.
const fs = require('fs');
const { Client } = require('pg');

const BASE_PRUEBAS = 'portal_test';
const RUTA_ESQUEMA = process.env.SCHEMA_PATH || '/schema/init.sql';

function urlParaBase(nombre) {
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${nombre}`;
  return url.toString();
}

module.exports = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('Falta DATABASE_URL: ejecuta las pruebas dentro del contenedor api');
  }
  if (!fs.existsSync(RUTA_ESQUEMA)) {
    throw new Error(`No se encontró el esquema en ${RUTA_ESQUEMA}`);
  }

  const admin = new Client({ connectionString: urlParaBase('postgres') });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${BASE_PRUEBAS} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${BASE_PRUEBAS}`);
  await admin.end();

  const cliente = new Client({ connectionString: urlParaBase(BASE_PRUEBAS) });
  await cliente.connect();
  await cliente.query(fs.readFileSync(RUTA_ESQUEMA, 'utf8'));
  await cliente.end();
};
