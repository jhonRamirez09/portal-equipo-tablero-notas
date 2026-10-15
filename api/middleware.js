const jwt = require('jsonwebtoken');
const pool = require('./db');

async function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  const token = authHeader.split(' ')[1];

  let datos;
  try {
    datos = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  try {
    // Estado y rol ACTUALES desde la base de datos, no los del token
    const resultado = await pool.query(
      'SELECT id, nombre, rol, activo FROM usuarios WHERE id = $1',
      [datos.id]
    );

    if (resultado.rows.length === 0 || !resultado.rows[0].activo) {
      return res.status(403).json({ error: 'Tu cuenta fue desactivada' });
    }

    const u = resultado.rows[0];
    req.usuario = { id: u.id, nombre: u.nombre, rol: u.rol };
    next();
  } catch (error) {
    console.error('Error en verificarToken:', error);
    return res.status(500).json({ error: 'Error del servidor' });
  }
}

function soloAdmin(req, res, next) {
  if (req.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'Solo un administrador puede hacer esto' });
  }
  next();
}

module.exports = { verificarToken, soloAdmin };