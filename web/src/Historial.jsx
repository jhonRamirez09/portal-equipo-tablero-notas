import { useState, useEffect } from 'react';
import api, { mensajeDeError } from './api';
import { useAuth } from './AuthContext';

const POR_PAGINA = 20;
const VACIOS = { tipo_recurso: '', recurso_id: '' };

function formatearFecha(iso) {
  return new Date(iso).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'medium' });
}

export default function Historial() {
  const { usuario, logout } = useAuth();
  const esAdmin = usuario?.rol === 'admin';
  const [eventos, setEventos] = useState([]);
  const [pagina, setPagina] = useState(0);
  const [hayMas, setHayMas] = useState(false);
  const [filtros, setFiltros] = useState(VACIOS);
  const [aplicados, setAplicados] = useState(VACIOS);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    cargar(0, VACIOS);
  }, []);

  async function cargar(nuevaPagina, f) {
    setCargando(true);
    setError('');
    try {
      // Pedimos uno de más para saber si existe una página siguiente
      const params = { limite: POR_PAGINA + 1, desde: nuevaPagina * POR_PAGINA };
      if (f.tipo_recurso) params.tipo_recurso = f.tipo_recurso;
      if (f.recurso_id) params.recurso_id = f.recurso_id;
      const respuesta = await api.get('/historial', { params });
      setHayMas(respuesta.data.length > POR_PAGINA);
      setEventos(respuesta.data.slice(0, POR_PAGINA));
      setPagina(nuevaPagina);
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setCargando(false);
    }
  }

  function aplicarFiltros(e) {
    e.preventDefault();
    setAplicados(filtros);
    cargar(0, filtros);
  }

  function limpiarFiltros() {
    setFiltros(VACIOS);
    setAplicados(VACIOS);
    cargar(0, VACIOS);
  }

  return (
    <div className="history-page" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <a href="/dashboard">Dashboard</a> | <a href="/tablero">Tablero</a>
          {esAdmin && <> | <a href="/admin">Administración</a></>}
          {' | '}<a href="/cambiar-password">Cambiar contraseña</a>
        </div>
        <div>
          {usuario?.nombre} ({usuario?.rol}) — <button onClick={logout}>Cerrar sesión</button>
        </div>
      </div>

      <h2>Historial de actividad</h2>

      <form onSubmit={aplicarFiltros} style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {esAdmin && (
          <select value={filtros.tipo_recurso} onChange={(e) => setFiltros({ ...filtros, tipo_recurso: e.target.value })}>
            <option value="">Notas y usuarios</option>
            <option value="nota">Solo notas</option>
            <option value="usuario">Solo usuarios</option>
          </select>
        )}
        <input
          type="number"
          min="1"
          placeholder="Id del recurso"
          value={filtros.recurso_id}
          onChange={(e) => setFiltros({ ...filtros, recurso_id: e.target.value })}
        />
        <button type="submit">Filtrar</button>
        <button type="button" onClick={limpiarFiltros}>Limpiar filtros</button>
      </form>

      {error && (
        <p style={{ color: 'red' }}>
          {error} <button onClick={() => cargar(pagina, aplicados)}>Reintentar</button>
        </p>
      )}
      {cargando && <p>Cargando historial...</p>}
      {!cargando && !error && eventos.length === 0 && <p>No hay eventos para mostrar.</p>}

      {eventos.length > 0 && (
        <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Operación</th>
              <th>Usuario</th>
              <th>Recurso</th>
              <th>Resumen</th>
            </tr>
          </thead>
          <tbody>
            {eventos.map((ev) => (
              <tr key={ev.id}>
                <td>{formatearFecha(ev.creado_en)}</td>
                <td>{ev.tipo_operacion}</td>
                <td>{ev.usuario_nombre}</td>
                <td>{ev.tipo_recurso} #{ev.recurso_id}</td>
                <td>{ev.resumen}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
        <button disabled={pagina === 0 || cargando} onClick={() => cargar(pagina - 1, aplicados)}>Anterior</button>
        <span>Página {pagina + 1}</span>
        <button disabled={!hayMas || cargando} onClick={() => cargar(pagina + 1, aplicados)}>Siguiente</button>
      </div>
    </div>
  );
}
