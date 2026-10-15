import { useState, useEffect } from 'react';
import api, { mensajeDeError } from './api';
import Nota from './Nota';
import { useAuth } from './AuthContext';

const FILTROS_VACIOS = { q: '', estado: '', creador: '' };

export default function Tablero() {
  const [notas, setNotas] = useState([]);
  const [creadores, setCreadores] = useState([]);
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);   // lo que se escribe
  const [aplicados, setAplicados] = useState(FILTROS_VACIOS); // lo que se consultó
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const { logout, usuario } = useAuth();

  useEffect(() => {
    cargarNotas(FILTROS_VACIOS);
    cargarCreadores();
  }, []);

  async function cargarNotas(filtrosAplicar) {
    setCargando(true);
    setError('');
    try {
      const params = {};
      if (filtrosAplicar.q.trim()) params.q = filtrosAplicar.q.trim();
      if (filtrosAplicar.estado) params.estado = filtrosAplicar.estado;
      if (filtrosAplicar.creador) params.creador = filtrosAplicar.creador;
      const respuesta = await api.get('/notas', { params });
      setNotas(respuesta.data);
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setCargando(false);
    }
  }

  async function cargarCreadores() {
    try {
      const respuesta = await api.get('/notas/creadores');
      setCreadores(respuesta.data);
    } catch (err) {
      // Si falla solo se queda el filtro de creador vacío; el error principal ya se muestra arriba
    }
  }

  function aplicarFiltros(e) {
    e.preventDefault();
    setAplicados(filtros);
    cargarNotas(filtros);
  }

  function limpiarFiltros() {
    setFiltros(FILTROS_VACIOS);
    setAplicados(FILTROS_VACIOS);
    cargarNotas(FILTROS_VACIOS);
  }

  async function crearNota() {
    setError('');
    try {
      await api.post('/notas', {
        titulo: 'Nueva nota',
        texto: '',
        posicion_x: Math.round(50 + Math.random() * 200),
        posicion_y: Math.round(50 + Math.random() * 200),
      });
      // Limpiamos los filtros para que la nota nueva siempre se vea
      limpiarFiltros();
      cargarCreadores();
    } catch (err) {
      setError(mensajeDeError(err));
    }
  }

  function actualizarNotaLocal(notaActualizada) {
    setNotas(
      notas.map((n) =>
        n.id === notaActualizada.id
          ? { ...n, ...notaActualizada, modificado_por_nombre: usuario?.nombre }
          : n
      )
    );
  }

  function eliminarNotaLocal(id) {
    setNotas(notas.filter((n) => n.id !== id));
  }

  return (
    <div className="board-page" style={{ padding:24}}>
      <div style={{ display: 'flex', justifyContent : 'space-between', marginBottom: 16, border: '1px solid #e7e5f4' , borderRadius: '10px' }}>
        <div>
          <button onClick={crearNota}>+ Nueva nota</button>
          {' '}
          <a href="/dashboard">Ir al dashboard</a>
          {' '}
          <a href="/historial">Historial</a>
          {' '}
          <a href="/cambiar-password">Cambiar contraseña</a>
          {' '}
          {usuario?.rol === 'admin' && <a href="/admin">Administración</a>}
        </div>
        <div>
          {usuario?.nombre} — <button className="logout-button" onClick={logout}>Cerrar sesión</button>
        </div>
      </div>

      <form
        className="board-filters"
        onSubmit={aplicarFiltros}
        style={{ padding: 10, background: '#f8f9fa', borderBottom: '1px solid #ddd', display: 'flex', gap: 8, flexWrap: 'wrap' }}
      >
        <input
          type="text"
          placeholder="Buscar en título o contenido"
          value={filtros.q}
          onChange={(e) => setFiltros({ ...filtros, q: e.target.value })}
          style={{ padding: 6, minWidth: 220 }}
        />
        <select value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}>
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="en_curso">En curso</option>
          <option value="hecho">Hecho</option>
        </select>
        <select value={filtros.creador} onChange={(e) => setFiltros({ ...filtros, creador: e.target.value })}>
          <option value="">Todos los creadores</option>
          {creadores.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
        <button type="submit">Buscar</button>
        <button type="button" onClick={limpiarFiltros}>Limpiar filtros</button>
      </form>

      {error && (
        <div style={{ padding: 10, background: '#f8d7da', color: '#842029', borderBottom: '1px solid #f5c2c7' }}>
          {error}{' '}
          <button onClick={() => cargarNotas(aplicados)}>Reintentar</button>
        </div>
      )}

      {cargando && <p style={{ padding: 10 }}>Cargando notas...</p>}

      {!cargando && !error && notas.length === 0 && (
        <p style={{ padding: 10 }}>No se encontraron notas con estos filtros.</p>
      )}

      <div className="board-canvas" style={{ position: 'relative', width: '100%', height: 'calc(100vh - 110px)', backgroundColor: '#e9ecef', overflow: 'hidden' }}>
        {notas.map((nota) => (
          <Nota
            key={`${nota.id}-${nota.version}`}
            nota={nota}
            onActualizar={actualizarNotaLocal}
            onEliminar={eliminarNotaLocal}
            onRecargar={() => cargarNotas(aplicados)}
          />
        ))}
      </div>
    </div>
  );
}
