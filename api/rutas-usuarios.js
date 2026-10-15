const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('./db');
const { verificarToken, soloAdmin } = require('./middleware');
const { registrarHistorial } = require('./historial');
const { validarPasswordNueva, validarCorreo, validarNombre } = require('./validaciones');

const router = express.Router();
router.use(verificarToken, soloAdmin);

const ROLES = ['admin', 'usuario'];
const COLUMNAS = 'id, nombre, correo, rol, activo';

// Se usa al inicio de una transacción. Bloquea TODAS las filas de administradores
// siempre en el mismo orden (por id). Así dos operaciones simultáneas hacen fila
// en vez de bloquearse mutuamente (deadlock), y la regla del último admin se evalúa
// sobre datos que nadie más puede cambiar mientras decidimos.
async function bloquearAdmins(client) {
  const r = await client.query(
    "SELECT id, activo FROM usuarios WHERE rol = 'admin' ORDER BY id FOR UPDATE"
  );
  return r.rows;
}

const hayOtroAdminActivo = (admins, idExcluido) =>
  admins.some((a) => a.activo && a.id !== idExcluido);

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

  const errorValidacion =
    validarNombre(nombre) ||
    validarCorreo(correo) ||
    validarPasswordNueva(password) ||
    (!ROLES.includes(rol) ? 'Rol inválido' : null);
  if (errorValidacion) {
    return res.status(400).json({ error: errorValidacion });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const resultado = await pool.query(
      `INSERT INTO usuarios (nombre, correo, password_hash, rol, activo)
       VALUES ($1, $2, $3, $4, true)
       RETURNING ${COLUMNAS}`,
      [nombre.trim(), correo.trim().toLowerCase(), hash, rol]
    );
    const nuevo = resultado.rows[0];

    await registrarHistorial({
      tipo: 'creacion_usuario',
      usuarioId: req.usuario.id,
      recurso: 'usuario',
      recursoId: nuevo.id,
      resumen: `Se creó el usuario "${nuevo.nombre}" con rol ${nuevo.rol}`
    });

    res.status(201).json(nuevo);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ese correo ya está registrado' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// EDITAR usuario (nombre, correo, rol)
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { nombre, correo, rol } = req.body;

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Id inválido' });
  }
  const errorValidacion =
    validarNombre(nombre) ||
    validarCorreo(correo) ||
    (!ROLES.includes(rol) ? 'Rol inválido' : null);
  if (errorValidacion) {
    return res.status(400).json({ error: errorValidacion });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const admins = await bloquearAdmins(client);

    const actual = await client.query(
      `SELECT ${COLUMNAS} FROM usuarios WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (actual.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    const antes = actual.rows[0];

    // Regla: no quitarle el rol de admin al último administrador activo
    if (antes.rol === 'admin' && antes.activo && rol !== 'admin') {
      if (!hayOtroAdminActivo(admins, id)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Debe existir al menos un administrador activo' });
      }
    }

    const resultado = await client.query(
      `UPDATE usuarios SET nombre = $1, correo = $2, rol = $3
       WHERE id = $4
       RETURNING ${COLUMNAS}`,
      [nombre.trim(), correo.trim().toLowerCase(), rol, id]
    );
    await client.query('COMMIT');
    const despues = resultado.rows[0];

    const cambios = [];
    if (antes.nombre !== despues.nombre) cambios.push('nombre');
    if (antes.correo !== despues.correo) cambios.push('correo');
    if (antes.rol !== despues.rol) cambios.push(`rol (${antes.rol} → ${despues.rol})`);

    if (cambios.length > 0) {
      await registrarHistorial({
        tipo: 'edicion_usuario',
        usuarioId: req.usuario.id,
        recurso: 'usuario',
        recursoId: id,
        resumen: `Se editó el usuario "${despues.nombre}": ${cambios.join(', ')}`
      });
    }

    res.json(despues);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ese correo ya está registrado' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  } finally {
    client.release();
  }
});

// ACTIVAR / DESACTIVAR usuario
router.patch('/:id/estado', async (req, res) => {
  const id = Number(req.params.id);
  const { activo } = req.body;

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Id inválido' });
  }
  if (typeof activo !== 'boolean') {
    return res.status(400).json({ error: 'El campo activo debe ser true o false' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const admins = await bloquearAdmins(client);

    const actual = await client.query(
      `SELECT ${COLUMNAS} FROM usuarios WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (actual.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    const antes = actual.rows[0];

    if (antes.activo === activo) {
      await client.query('ROLLBACK');
      return res.json(antes);
    }

    // Regla: no desactivar al último administrador activo
    if (activo === false && antes.rol === 'admin') {
      if (!hayOtroAdminActivo(admins, id)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Debe existir al menos un administrador activo' });
      }
    }

    const resultado = await client.query(
      `UPDATE usuarios SET activo = $1 WHERE id = $2 RETURNING ${COLUMNAS}`,
      [activo, id]
    );
    await client.query('COMMIT');
    const despues = resultado.rows[0];

    await registrarHistorial({
      tipo: activo ? 'reactivacion_usuario' : 'desactivacion_usuario',
      usuarioId: req.usuario.id,
      recurso: 'usuario',
      recursoId: id,
      resumen: `${activo ? 'Se reactivó' : 'Se desactivó'} al usuario "${despues.nombre}"`
    });

    res.json(despues);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  } finally {
    client.release();
  }
});

module.exports = router;
