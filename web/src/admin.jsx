import { useState, useEffect } from 'react';
import api, { mensajeDeError } from './api';
import { useAuth } from './AuthContext';

function validarNuevoUsuario({ nombre, correo, password }) {
  if (nombre.trim().length === 0 || nombre.trim().length > 100) {
    return 'El nombre debe tener entre 1 y 100 caracteres';
  }
  if (correo.trim().length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) {
    return 'El correo no tiene un formato válido';
  }
  if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
  if (password.length > 72) return 'La contraseña no puede superar 72 caracteres';
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'La contraseña debe incluir mayúscula, minúscula y número';
  }
  return '';
}

export default function Admin() {
  const { usuario, logout } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  // Formulario para crear usuario nuevo
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState('usuario');

  useEffect(() => {
    cargarUsuarios();
  }, []);

  async function cargarUsuarios() {
    try {
      const respuesta = await api.get('/usuarios');
      setUsuarios(respuesta.data);
    } catch (err) {
      setError(mensajeDeError(err));
    }
  }

  async function crearUsuario(e) {
    e.preventDefault();
    setError('');
    setExito('');

    const errorLocal = validarNuevoUsuario({ nombre, correo, password });
    if (errorLocal) {
      setError(errorLocal);
      return;
    }

    try {
      await api.post('/usuarios', { nombre, correo, password, rol });
      setNombre('');
      setCorreo('');
      setPassword('');
      setRol('usuario');
      setExito('Usuario creado correctamente');
      cargarUsuarios();
    } catch (err) {
      setError(mensajeDeError(err));
    }
  }

  async function cambiarRol(id, nuevoRol, nombreActual, correoActual) {
    setError('');
    setExito('');
    if (!window.confirm(`¿Cambiar el rol de ${nombreActual} a ${nuevoRol}?`)) return;
    try {
      await api.put(`/usuarios/${id}`, { nombre: nombreActual, correo: correoActual, rol: nuevoRol });
      setExito('Rol actualizado');
      cargarUsuarios();
    } catch (err) {
      setError(mensajeDeError(err));
    }
  }

  async function cambiarEstado(id, activo, nombreActual) {
    setError('');
    setExito('');
    if (!activo && !window.confirm(`¿Desactivar a ${nombreActual}?`)) return;
    try {
      await api.patch(`/usuarios/${id}/estado`, { activo });
      setExito(activo ? 'Usuario reactivado' : 'Usuario desactivado');
      cargarUsuarios();
    } catch (err) {
      setError(mensajeDeError(err));
    }
  }

  return (
    <div className="admin-page" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <a href="/dashboard">Dashboard</a> | <a href="/tablero">Tablero</a> |{' '}
          <a href="/historial">Historial</a> | <a href="/cambiar-password">Cambiar contraseña</a>
        </div>
        <div>
          {usuario?.nombre} ({usuario?.rol}) — <button onClick={logout}>Cerrar sesión</button>
        </div>
      </div>

      <h2>Administración de usuarios</h2>

      {error && <p style={{ color: 'red' }}>{error}</p>}
      {exito && <p style={{ color: 'green' }}>{exito}</p>}

      <h3>Crear usuario nuevo</h3>
      <form onSubmit={crearUsuario} style={{ marginBottom: 24, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={100} required />
        <input placeholder="Correo" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} maxLength={100} required />
        <input placeholder="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <select value={rol} onChange={(e) => setRol(e.target.value)}>
          <option value="usuario">Usuario</option>
          <option value="admin">Administrador</option>
        </select>
        <button type="submit">Crear</button>
      </form>

      <h3>Usuarios existentes</h3>
      <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Correo</th>
            <th>Rol</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((u) => (
            <tr key={u.id}>
              <td>{u.nombre}{u.id === usuario?.id && ' (tú)'}</td>
              <td>{u.correo}</td>
              <td>
                <select
                  value={u.rol}
                  onChange={(e) => cambiarRol(u.id, e.target.value, u.nombre, u.correo)}
                >
                  <option value="usuario">Usuario</option>
                  <option value="admin">Administrador</option>
                </select>
              </td>
              <td>{u.activo ? 'Activo' : 'Inactivo'}</td>
              <td>
                {u.activo ? (
                  <button onClick={() => cambiarEstado(u.id, false, u.nombre)}>Desactivar</button>
                ) : (
                  <button onClick={() => cambiarEstado(u.id, true, u.nombre)}>Reactivar</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}