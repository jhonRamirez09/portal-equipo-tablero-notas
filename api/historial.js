const pool = require('./db');

// Guarda un evento en la tabla historial.
// Nunca se le pasan contraseñas ni tokens, solo un resumen corto.
async function registrarHistorial({ tipo, usuarioId, recurso, recursoId, resumen }) {
  try {
    await pool.query(
      `INSERT INTO historial (tipo_operacion, usuario_id, tipo_recurso, recurso_id, resumen)
       VALUES ($1, $2, $3, $4, $5)`,
      [tipo, usuarioId, recurso, recursoId, resumen]
    );
  } catch (error) {
    console.error('No se pudo registrar el historial:', error.message);
  }
}

module.exports = { registrarHistorial };