const express = require('express');
const pool = require('./db');
const { verificarToken } = require('./middleware');

const router = express.Router();

// Todas las rutas requieren estar logueado (admin o usuario, cualquiera)
router.use(verificarToken);

// LISTAR todas las notas
router.get('/', async (req, res) => {
  try {
    const resultado = await pool.query('SELECT * FROM notas ORDER BY id');
    res.json(resultado.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// CREAR una nota nueva
router.post('/', async (req, res) => {
  const { titulo, texto, posicion_x, posicion_y } = req.body;

  if (!titulo) {
    return res.status(400).json({ error: 'El título es obligatorio' });
  }

  try {
    const resultado = await pool.query(
      `INSERT INTO notas (titulo, texto, estado, posicion_x, posicion_y)
       VALUES ($1, $2, 'pendiente', $3, $4)
       RETURNING *`,
      [titulo, texto || '', posicion_x || 100, posicion_y || 100]
    );
    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// EDITAR contenido de una nota (título, texto, estado)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { titulo, texto, estado } = req.body;

  try {
    const resultado = await pool.query(
      `UPDATE notas SET titulo = $1, texto = $2, estado = $3
       WHERE id = $4
       RETURNING *`,
      [titulo, texto, estado, id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Nota no encontrada' });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ACTUALIZAR SOLO la posición (se llama al soltar el mouse)
router.patch('/:id/posicion', async (req, res) => {
  const { id } = req.params;
  const { posicion_x, posicion_y } = req.body;

  try {
    const resultado = await pool.query(
      `UPDATE notas SET posicion_x = $1, posicion_y = $2
       WHERE id = $3
       RETURNING *`,
      [posicion_x, posicion_y, id]
    );
    res.json(resultado.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ELIMINAR una nota
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query('DELETE FROM notas WHERE id = $1', [id]);
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;