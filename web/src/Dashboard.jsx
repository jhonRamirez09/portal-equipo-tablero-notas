import { useState, useEffect } from 'react';
import api, { mensajeDeError } from './api';
import { useAuth } from './AuthContext';

const URL_METRICAS = 'http://localhost:3001/metricas';

const tarjeta = (fondo) => ({ padding: 16, background: fondo, borderRadius: 8, minWidth: 130 });

function formatearFecha(iso) {
  return new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'medium' });
}

export default function Dashboard() {
  const { usuario, logout } = useAuth();
  const [metricas, setMetricas] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    cargarMetricas();
  }, []);

  async function cargarMetricas() {
    setCargando(true);
    setError('');
    try {
      const respuesta = await api.get(URL_METRICAS);
      setMetricas(respuesta.data);
    } catch (err) {
      setMetricas(null);
      setError(`No se pudieron cargar las métricas. ${mensajeDeError(err)}`);
    } finally {
      setCargando(false);
    }
  }

  const estados = [
    { clave: 'pendiente', etiqueta: 'Pendiente', fondo: '#fff3cd' },
    { clave: 'en_curso', etiqueta: 'En curso', fondo: '#cfe2ff' },
    { clave: 'hecho', etiqueta: 'Hecho', fondo: '#d1e7dd' },
  ];

  return (
    <div className="dashboard-page" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <a href="/tablero">Ir al tablero</a>
          {' | '}
          <a href="/historial">Historial</a>
          {' | '}
          <a href="/cambiar-password">Cambiar contraseña</a>
          {usuario?.rol === 'admin' && <> | <a href="/admin">Administración</a></>}
        </div>
        <div>
          {usuario?.nombre} ({usuario?.rol}) — <button className="logout-button" onClick={logout}>Cerrar sesión</button>
        </div>
      </div>

      <h2>Dashboard</h2>
      <button onClick={cargarMetricas} disabled={cargando}>
        {cargando ? 'Actualizando...' : 'Actualizar'}
      </button>

      {cargando && <p>Cargando métricas...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {metricas && !cargando && (
        <>
          <p style={{ color: '#555' }}>
            Última actualización de las métricas: {formatearFecha(metricas.ultima_actualizacion)}
          </p>

          <div className="metrics-grid" style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
            <div style={tarjeta('#fff')}>
              <h3>{metricas.total}</h3>
              <p>Total de notas</p>
            </div>
            {estados.map((e) => (
              <div key={e.clave} style={tarjeta(e.fondo)}>
                <h3>{metricas.distribucion[e.clave]}</h3>
                <p>{e.etiqueta} ({metricas.porcentajes[e.clave]}%)</p>
              </div>
            ))}
          </div>

          <h3 style={{ marginTop: 24 }}>Últimos 7 días</h3>
          <div className="metrics-grid secondary-metrics" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={tarjeta('#fff')}>
              <h3>{metricas.ultimos_7_dias.creadas}</h3>
              <p>Notas creadas</p>
            </div>
            <div style={tarjeta('#fff')}>
              <h3>{metricas.ultimos_7_dias.modificadas}</h3>
              <p>Notas modificadas</p>
            </div>
          </div>

          <h3 style={{ marginTop: 24 }}>Notas creadas por usuario</h3>
          <table className="notes-created-table" border="1" cellPadding="8" style={{ borderCollapse: 'collapse', background: '#fff' }}>
            <thead>
              <tr><th>Usuario</th><th>Notas creadas</th></tr>
            </thead>
            <tbody>
              {metricas.notas_por_usuario.map((u) => (
                <tr key={u.usuario_id}>
                  <td>{u.nombre}</td>
                  <td>{u.cantidad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
