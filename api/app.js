const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('./db');
const { verificarToken } = require('./middleware');
const { registrarHistorial } = require('./historial');
const { validarPasswordNueva } = require('./validaciones');

const app = express();
app.disable('x-powered-by');
app.use(cors());
app.use(express.json());

const rutasUsuarios = require('./rutas-usuarios');
app.use('/api/usuarios', rutasUsuarios);

const rutasNotas = require('./rutas-notas');
app.use('/api/notas', rutasNotas);

const rutasHistorial = require('./rutas-historial');
app.use('/api/historial', rutasHistorial);

// --- LOGIN ---
app.post('/api/login', async (req, res) => {
  const { correo, password } = req.body;

  if (typeof correo !== 'string' || typeof password !== 'string' || !correo || !password) {
    return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });
  }

  try {
    const resultado = await pool.query(
      'SELECT * FROM usuarios WHERE correo = $1',
      [correo]
    );

    const usuario = resultado.rows[0];

    if (!usuario) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    if (!usuario.activo) {
      return res.status(403).json({ error: 'Este usuario está desactivado' });
    }

    const passwordValida = await bcrypt.compare(password, usuario.password_hash);

    if (!passwordValida) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    const token = jwt.sign(
      { id: usuario.id, rol: usuario.rol, nombre: usuario.nombre },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        rol: usuario.rol,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// --- CAMBIO DE CONTRASEÑA (usuario autenticado) ---
app.put('/api/cambiar-password', verificarToken, async (req, res) => {
  const { password_actual, password_nueva } = req.body;

  if (typeof password_actual !== 'string' || !password_actual) {
    return res.status(400).json({ error: 'La contraseña actual es obligatoria' });
  }

  const errorValidacion = validarPasswordNueva(password_nueva);
  if (errorValidacion) {
    return res.status(400).json({ error: errorValidacion });
  }

  if (password_actual === password_nueva) {
    return res.status(400).json({ error: 'La nueva contraseña debe ser distinta a la actual' });
  }

  try {
    const resultado = await pool.query(
      'SELECT password_hash FROM usuarios WHERE id = $1',
      [req.usuario.id]
    );

    if (resultado.rows.length === 0) {
      return res.status(401).json({ error: 'Sesión inválida, inicia sesión de nuevo' });
    }

    const coincide = await bcrypt.compare(password_actual, resultado.rows[0].password_hash);
    if (!coincide) {
      return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
    }

    const nuevoHash = await bcrypt.hash(password_nueva, 10);
    await pool.query('UPDATE usuarios SET password_hash = $1 WHERE id = $2', [
      nuevoHash,
      req.usuario.id,
    ]);

    // El resumen NO incluye ninguna contraseña
    await registrarHistorial({
      tipo: 'cambio_password',
      usuarioId: req.usuario.id,
      recurso: 'usuario',
      recursoId: req.usuario.id,
      resumen: 'El usuario cambió su contraseña'
    });

    res.json({ mensaje: 'Contraseña actualizada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// --- RUTA DE PRUEBA ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// --- Manejo de errores: nunca se devuelven detalles internos al cliente ---
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') {
    return res.status(400).json({ error: 'El cuerpo de la petición no es válido' });
  }
  console.error('Error no controlado:', err);
  res.status(500).json({ error: 'Error del servidor' });
});

module.exports = app;
