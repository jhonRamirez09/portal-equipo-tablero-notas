const { Client } = require('pg');
const jwt = require('jsonwebtoken');
const { calcularMetricas } = require('./metricas');

const CABECERAS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function responder(statusCode, cuerpo) {
  return { statusCode, headers: CABECERAS, body: JSON.stringify(cuerpo) };
}

function extraerToken(event) {
  const headers = event.headers || {};
  const clave = Object.keys(headers).find((k) => k.toLowerCase() === 'authorization');
  const valor = clave ? headers[clave] : '';
  return typeof valor === 'string' && valor.startsWith('Bearer ') ? valor.split(' ')[1] : null;
}

// Abre una conexión, ejecuta la consulta y siempre la cierra
async function conBaseDeDatos(operacion) {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });
  await client.connect();
  try {
    return await operacion(client);
  } finally {
    await client.end().catch(() => {});
  }
}

// Acceso real a los datos persistidos
const datosReales = {
  async usuarioActivo(id) {
    return conBaseDeDatos(async (client) => {
      const r = await client.query('SELECT activo FROM usuarios WHERE id = $1', [id]);
      return r.rows.length > 0 && r.rows[0].activo === true;
    });
  },
  async obtenerNotas() {
    return conBaseDeDatos(async (client) => {
      const r = await client.query(
        `SELECT n.id, n.estado, n.creado_en, n.actualizado_en,
                n.creado_por, u.nombre AS creador
         FROM notas n
         JOIN usuarios u ON u.id = n.creado_por`
      );
      return r.rows;
    });
  },
};

// Las dependencias se inyectan para poder probar el handler sin base de datos
function crearHandler({ usuarioActivo, obtenerNotas, ahora = () => new Date() }) {
  return async (event) => {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers: CABECERAS, body: '' };
    }
    if (event.httpMethod && event.httpMethod !== 'GET') {
      return responder(405, { error: 'Método no permitido' });
    }

    if (!process.env.JWT_SECRET) {
      console.error('Falta la variable JWT_SECRET');
      return responder(500, { error: 'Configuración del servidor incompleta' });
    }

    const token = extraerToken(event);
    if (!token) return responder(401, { error: 'No autenticado' });

    let datos;
    try {
      datos = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return responder(401, { error: 'Token inválido o expirado' });
    }

    try {
      if (!(await usuarioActivo(datos.id))) {
        return responder(403, { error: 'Tu cuenta fue desactivada' });
      }
      const notas = await obtenerNotas();
      return responder(200, calcularMetricas(notas, ahora()));
    } catch (error) {
      // El detalle va solo al log; al cliente nunca se le devuelve información interna
      console.error('Error al calcular métricas:', error.message);
      return responder(500, { error: 'No se pudieron calcular las métricas' });
    }
  };
}

exports.crearHandler = crearHandler;
exports.handler = crearHandler(datosReales);