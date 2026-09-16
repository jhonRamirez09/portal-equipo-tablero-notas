const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('./db');
const { verificarToken, soloAdmin } = require('./middleware');

const router = express.Router();

// Todas las rutas de aquí abajo requieren estar logueado Y ser admin
router.use(verificarToken, soloAdmin);

// LISTAR usuarios
router.get('/', async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT id, nombre, correo, rol, activo, creado_en FROM usuarios ORDER BY id'
    );
    res.json(resultado.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// CREAR usuario
router.post('/', async (req, res) => {
  const { nombre, correo, password, rol } = req.body;

  if (!nombre || !correo || !password || !rol) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  if (!['admin', 'usuario'].includes(rol)) {
    return res.status(400).json({ error: 'Rol inválido' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const resultado = await pool.query(
      `INSERT INTO usuarios (nombre, correo, password_hash, rol, activo)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id, nombre, correo, rol, activo`,
      [nombre, correo, hash, rol]
    );
    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // correo duplicado
      return res.status(409).json({ error: 'Ese correo ya está registrado' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// EDITAR usuario (nombre, correo, rol)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, correo, rol } = req.body;

  try {
    const resultado = await pool.query(
      `UPDATE usuarios SET nombre = $1, correo = $2, rol = $3
       WHERE id = $4
       RETURNING id, nombre, correo, rol, activo`,
      [nombre, correo, rol, id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ACTIVAR / DESACTIVAR usuario
router.patch('/:id/estado', async (req, res) => {
  const { id } = req.params;
  const { activo } = req.body; // true o false

  try {
    // Regla de negocio: no permitir desactivar al último admin activo
    if (activo === false) {
      const usuarioActual = await pool.query('SELECT rol FROM usuarios WHERE id = $1', [id]);

      if (usuarioActual.rows[0]?.rol === 'admin') {
        const admins = await pool.query(
          "SELECT COUNT(*) FROM usuarios WHERE rol = 'admin' AND activo = true"
        );
        if (parseInt(admins.rows[0].count) <= 1) {
          return res.status(400).json({ error: 'Debe existir al menos un administrador activo' });
        }
      }
    }

    const resultado = await pool.query(
      'UPDATE usuarios SET activo = $1 WHERE id = $2 RETURNING id, nombre, correo, rol, activo',
      [activo, id]
    );

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;