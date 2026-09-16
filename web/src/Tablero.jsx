import { useState, useEffect } from 'react';
import api from './api';
import Nota from './Nota';
import { useAuth } from './AuthContext';

export default function Tablero() {
  const [notas, setNotas] = useState([]);
  const { logout, usuario } = useAuth();

  useEffect(() => {
    cargarNotas();
  }, []);

  async function cargarNotas() {
    try {
      const respuesta = await api.get('/notas');
      setNotas(respuesta.data);
    } catch (error) {
      console.error('Error al cargar notas', error);
    }
  }

  async function crearNota() {
    try {
      const respuesta = await api.post('/notas', {
        titulo: 'Nueva nota',
        texto: '',
        posicion_x: Math.round(50 + Math.random() * 200),
        posicion_y: Math.round(50 + Math.random() * 200),
      });
      setNotas([...notas, respuesta.data]);
    } catch (error) {
      console.error('Error al crear nota', error);
    }
  }

  function actualizarNotaLocal(notaActualizada) {
    setNotas(notas.map((n) => (n.id === notaActualizada.id ? notaActualizada : n)));
  }

  function eliminarNotaLocal(id) {
    setNotas(notas.filter((n) => n.id !== id));
  }

  return (
    <div className="board-page">
      <div style={{ padding: 12, background: '#fff', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <button onClick={crearNota}>+ Nueva nota</button>
          {' '}
          <a href="/dashboard">Ir al dashboard</a>
          {' '}
          {usuario?.rol === 'admin' && <a href="/admin">Administración</a>}
        </div>
        <div>
          {usuario?.nombre} — <button onClick={logout}>Cerrar sesión</button>
        </div>
      </div>

      <div className="board-canvas" style={{ position: 'relative', width: '100%', height: 'calc(100vh - 60px)', backgroundColor: '#e9ecef', overflow: 'hidden' }}>
        {notas.map((nota) => (
          <Nota
            key={nota.id}
            nota={nota}
            onActualizar={actualizarNotaLocal}
            onEliminar={eliminarNotaLocal}
          />
        ))}
      </div>
    </div>
  );
}
