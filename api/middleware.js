const jwt = require('jsonwebtoken');
const pool = require('./db');

async function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const datos = jwt.verify(token, process.env.JWT_SECRET);

    // Revisamos en la base de datos si el usuario SIGUE activo ahora mismo,
    // no solo en el momento en que se logueó.
    const resultado = await pool.query('SELECT activo FROM usuarios WHERE id = $1', [datos.id]);

    if (resultado.rows.length === 0 || !resultado.rows[0].activo) {
      return res.status(403).json({ error: 'Tu cuenta fue desactivada' });
    }

    req.usuario = datos;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

function soloAdmin(req, res, next) {
  if (req.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'Solo un administrador puede hacer esto' });
  }
  next();
}

module.exports = { verificarToken, soloAdmin };