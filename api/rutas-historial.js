const express = require('express');
const pool = require('./db');
const { verificarToken } = require('./middleware');

const router = express.Router();
router.use(verificarToken);

// GET /api/historial?tipo_recurso=nota&recurso_id=3&limite=50&desde=0
router.get('/', async (req, res) => {
  const { tipo_recurso, recurso_id } = req.query;
  const esAdmin = req.usuario.rol === 'admin';
  const condiciones = [];
  const valores = [];

  if (tipo_recurso !== undefined && tipo_recurso !== '') {
    if (!['nota', 'usuario'].includes(tipo_recurso)) {
      return res.status(400).json({ error: 'tipo_recurso debe ser nota o usuario' });
    }
    if (!esAdmin && tipo_recurso !== 'nota') {
      return res.status(403).json({ error: 'No tienes permisos para ver este historial' });
    }
    valores.push(tipo_recurso);
    condiciones.push(`h.tipo_recurso = $${valores.length}`);
  } else if (!esAdmin) {
    // Un usuario normal solo ve el historial de las notas
    condiciones.push("h.tipo_recurso = 'nota'");
  }

  if (recurso_id !== undefined && recurso_id !== '') {
    const idRecurso = Number(recurso_id);
    if (!Number.isInteger(idRecurso)) {
      return res.status(400).json({ error: 'recurso_id no es válido' });
    }
    valores.push(idRecurso);
    condiciones.push(`h.recurso_id = $${valores.length}`);
  }

  const limite = req.query.limite === undefined ? 50 : Number(req.query.limite);
  const desde = req.query.desde === undefined ? 0 : Number(req.query.desde);
  if (!Number.isInteger(limite) || limite < 1 || limite > 200 || !Number.isInteger(desde) || desde < 0) {
    return res.status(400).json({ error: 'limite debe estar entre 1 y 200 y desde debe ser 0 o mayor' });
  }

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
  valores.push(limite, desde);

  try {
    const resultado = await pool.query(
      `SELECT h.id, h.tipo_operacion, h.usuario_id, u.nombre AS usuario_nombre,
              h.tipo_recurso, h.recurso_id, h.resumen, h.creado_en
       FROM historial h
       JOIN usuarios u ON u.id = h.usuario_id
       ${where}
       ORDER BY h.id DESC
       LIMIT $${valores.length - 1} OFFSET $${valores.length}`,
      valores
    );
    res.json(resultado.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;