import { useState, useEffect } from 'react';
import api from './api';
import { useAuth } from './AuthContext';

export default function Admin() {
  const { usuario, logout } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [error, setError] = useState('');

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
      setError(err.response?.data?.error || 'Error al cargar usuarios');
    }
  }

  async function crearUsuario(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/usuarios', { nombre, correo, password, rol });
      setNombre('');
      setCorreo('');
      setPassword('');
      setRol('usuario');
      cargarUsuarios();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear usuario');
    }
  }

  async function cambiarRol(id, nuevoRol, nombreActual, correoActual) {
    try {
      await api.put(`/usuarios/${id}`, { nombre: nombreActual, correo: correoActual, rol: nuevoRol });
      cargarUsuarios();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cambiar rol');
    }
  }

  async function cambiarEstado(id, activo) {
    setError('');
    try {
      await api.patch(`/usuarios/${id}/estado`, { activo });
      cargarUsuarios();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cambiar estado');
    }
  }

  return (
    <div className="admin-page" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <a href="/dashboard">Dashboard</a> | <a href="/tablero">Tablero</a>
        </div>
        <div>
          {usuario?.nombre} ({usuario?.rol}) — <button onClick={logout}>Cerrar sesión</button>
        </div>
      </div>

      <h2>Administración de usuarios</h2>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <h3>Crear usuario nuevo</h3>
      <form onSubmit={crearUsuario} style={{ marginBottom: 24, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        <input placeholder="Correo" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} required />
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
              <td>{u.nombre}</td>
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
                  <button onClick={() => cambiarEstado(u.id, false)}>Desactivar</button>
                ) : (
                  <button onClick={() => cambiarEstado(u.id, true)}>Reactivar</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
