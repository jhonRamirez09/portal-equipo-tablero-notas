import { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const URL_METRICAS = 'http://localhost:3001/metricas';

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
      const respuesta = await fetch(URL_METRICAS);
      if (!respuesta.ok) throw new Error('Error al obtener métricas');
      const datos = await respuesta.json();
      setMetricas(datos);
    } catch (err) {
      setError('No se pudieron cargar las métricas. ¿Está corriendo sam local start-api?');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="dashboard-page" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <a href="/tablero">Ir al tablero</a>
            {usuario?.rol === 'admin' && <> | <a href="/admin">Administración</a></>}
        </div>
        <div>
          {usuario?.nombre} ({usuario?.rol}) — <button className="logout-button" onClick={logout}>Cerrar sesión</button>
        </div>
      </div>

      <h2>Dashboard</h2>
      <button onClick={cargarMetricas}>Actualizar</button>

      {cargando && <p>Cargando métricas...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {metricas && (
        <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
          <div style={{ padding: 16, background: '#fff', borderRadius: 8, minWidth: 120 }}>
            <h3>{metricas.total}</h3>
            <p>Total de notas</p>
          </div>
          <div style={{ padding: 16, background: '#fff3cd', borderRadius: 8, minWidth: 120 }}>
            <h3>{metricas.distribucion.pendiente}</h3>
            <p>Pendiente</p>
          </div>
          <div style={{ padding: 16, background: '#cfe2ff', borderRadius: 8, minWidth: 120 }}>
            <h3>{metricas.distribucion.en_curso}</h3>
            <p>En curso</p>
          </div>
          <div style={{ padding: 16, background: '#d1e7dd', borderRadius: 8, minWidth: 120 }}>
            <h3>{metricas.distribucion.hecho}</h3>
            <p>Hecho</p>
          </div>
        </div>
      )}
    </div>
  );
}
