const express = require('express');
const pool = require('./db');
const { verificarToken } = require('./middleware');
const { registrarHistorial } = require('./historial');

const router = express.Router();
router.use(verificarToken);

const ESTADOS = ['pendiente', 'en_curso', 'hecho'];

// Valida los campos de una nota. Devuelve un texto de error o null si todo está bien.
function validarNota({ titulo, texto, estado }, exigirEstado) {
  if (typeof titulo !== 'string' || titulo.trim().length === 0) {
    return 'El título es obligatorio';
  }
  if (titulo.trim().length > 200) {
    return 'El título no puede superar 200 caracteres';
  }
  if (texto !== undefined && texto !== null) {
    if (typeof texto !== 'string' || texto.length > 2000) {
      return 'El texto no puede superar 2000 caracteres';
    }
  }
  if (exigirEstado && !ESTADOS.includes(estado)) {
    return 'El estado debe ser pendiente, en_curso o hecho';
  }
  return null;
}

// LISTAR con búsqueda y filtros combinables:
// GET /api/notas?q=texto&estado=hecho&creador=2
router.get('/', async (req, res) => {
  const { q, estado, creador } = req.query;
  const condiciones = [];
  const valores = [];

  if (typeof q === 'string' && q.trim() !== '') {
    // Escapamos % y _ para que se busquen como texto normal
    const textoSeguro = q.trim().replace(/[\\%_]/g, '\\$&');
    valores.push(`%${textoSeguro}%`);
    condiciones.push(`(n.titulo ILIKE $${valores.length} OR n.texto ILIKE $${valores.length})`);
  }

  if (estado !== undefined && estado !== '') {
    if (!ESTADOS.includes(estado)) {
      return res.status(400).json({ error: 'El estado debe ser pendiente, en_curso o hecho' });
    }
    valores.push(estado);
    condiciones.push(`n.estado = $${valores.length}`);
  }

  if (creador !== undefined && creador !== '') {
    const idCreador = Number(creador);
    if (!Number.isInteger(idCreador)) {
      return res.status(400).json({ error: 'El filtro de creador no es válido' });
    }
    valores.push(idCreador);
    condiciones.push(`n.creado_por = $${valores.length}`);
  }

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  try {
    const resultado = await pool.query(
      `SELECT n.*, c.nombre AS creado_por_nombre, m.nombre AS modificado_por_nombre
       FROM notas n
       JOIN usuarios c ON c.id = n.creado_por
       JOIN usuarios m ON m.id = n.modificado_por
       ${where}
       ORDER BY n.id`,
      valores
    );
    res.json(resultado.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Usuarios que han creado notas (para llenar el filtro de creador)
router.get('/creadores', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT DISTINCT u.id, u.nombre
       FROM notas n JOIN usuarios u ON u.id = n.creado_por
       ORDER BY u.nombre`
    );
    res.json(resultado.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// CREAR
router.post('/', async (req, res) => {
  const { titulo, texto, posicion_x, posicion_y } = req.body;

  const errorValidacion = validarNota({ titulo, texto }, false);
  if (errorValidacion) {
    return res.status(400).json({ error: errorValidacion });
  }

  const x = Number.isFinite(Number(posicion_x)) ? Math.round(Number(posicion_x)) : 100;
  const y = Number.isFinite(Number(posicion_y)) ? Math.round(Number(posicion_y)) : 100;

  try {
    const resultado = await pool.query(
      `INSERT INTO notas (titulo, texto, estado, posicion_x, posicion_y, creado_por, modificado_por)
       VALUES ($1, $2, 'pendiente', $3, $4, $5, $5)
       RETURNING *`,
      [titulo.trim(), texto || '', x, y, req.usuario.id]
    );
    const nota = resultado.rows[0];

    await registrarHistorial({
      tipo: 'creacion_nota',
      usuarioId: req.usuario.id,
      recurso: 'nota',
      recursoId: nota.id,
      resumen: `Se creó la nota "${nota.titulo}"`
    });

    res.status(201).json(nota);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// EDITAR (con control de versión)
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { titulo, texto, estado, version } = req.body;

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Id inválido' });
  }
  if (!Number.isInteger(version)) {
    return res.status(400).json({ error: 'Falta la versión de la nota' });
  }
  const errorValidacion = validarNota({ titulo, texto, estado }, true);
  if (errorValidacion) {
    return res.status(400).json({ error: errorValidacion });
  }

  try {
    // 1. Leemos cómo está la nota ahora mismo
    const actual = await pool.query('SELECT * FROM notas WHERE id = $1', [id]);
    if (actual.rows.length === 0) {
      return res.status(404).json({ error: 'La nota ya no existe' });
    }
    const notaAnterior = actual.rows[0];

    // 2. Actualizamos SOLO si la versión sigue siendo la que el usuario vio
    const resultado = await pool.query(
      `UPDATE notas
       SET titulo = $1, texto = $2, estado = $3,
           modificado_por = $4, actualizado_en = NOW(), version = version + 1
       WHERE id = $5 AND version = $6
       RETURNING *`,
      [titulo.trim(), texto || '', estado, req.usuario.id, id, version]
    );

    // 3. Si no se actualizó ninguna fila, alguien editó antes: conflicto
    if (resultado.rows.length === 0) {
      return res.status(409).json({
        error: 'Esta nota fue modificada por otra persona. Recarga para ver los cambios.'
      });
    }
    const nota = resultado.rows[0];

    await registrarHistorial({
      tipo: 'edicion_nota',
      usuarioId: req.usuario.id,
      recurso: 'nota',
      recursoId: nota.id,
      resumen: `Se editó la nota "${nota.titulo}"`
    });

    if (notaAnterior.estado !== nota.estado) {
      await registrarHistorial({
        tipo: 'cambio_estado_nota',
        usuarioId: req.usuario.id,
        recurso: 'nota',
        recursoId: nota.id,
        resumen: `Estado de "${nota.titulo}": ${notaAnterior.estado} → ${nota.estado}`
      });
    }

    res.json(nota);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// MOVER (solo posición; no cambia la versión para que arrastrar no genere conflictos)
router.patch('/:id/posicion', async (req, res) => {
  const id = Number(req.params.id);
  const x = Math.round(Number(req.body.posicion_x));
  const y = Math.round(Number(req.body.posicion_y));

  if (!Number.isInteger(id) || !Number.isFinite(x) || !Number.isFinite(y)) {
    return res.status(400).json({ error: 'Datos de posición inválidos' });
  }

  try {
    const resultado = await pool.query(
      `UPDATE notas SET posicion_x = $1, posicion_y = $2
       WHERE id = $3
       RETURNING *`,
      [x, y, id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'La nota ya no existe' });
    }
    res.json(resultado.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ELIMINAR
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Id inválido' });
  }

  try {
    const resultado = await pool.query('DELETE FROM notas WHERE id = $1 RETURNING titulo', [id]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'La nota ya no existe' });
    }

    await registrarHistorial({
      tipo: 'eliminacion_nota',
      usuarioId: req.usuario.id,
      recurso: 'nota',
      recursoId: id,
      resumen: `Se eliminó la nota "${resultado.rows[0].titulo}"`
    });

    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;