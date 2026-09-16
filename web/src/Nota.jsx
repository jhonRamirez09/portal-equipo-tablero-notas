import { useState, useRef } from 'react';
import api from './api';

const COLORES_ESTADO = {
  pendiente: '#fff3cd',
  en_curso: '#cfe2ff',
  hecho: '#d1e7dd',
};

export default function Nota({ nota, onActualizar, onEliminar }) {
  const [titulo, setTitulo] = useState(nota.titulo);
  const [texto, setTexto] = useState(nota.texto);
  const [estado, setEstado] = useState(nota.estado);
  const [posicion, setPosicion] = useState({ x: nota.posicion_x, y: nota.posicion_y });
  const arrastrando = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  function manejarMouseDown(e) {
    // Si el clic fue en un input, textarea o select, no arrastramos (dejamos escribir)
    if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(e.target.tagName)) {
      return;
    }

    arrastrando.current = true;
    offset.current = {
      x: e.clientX - posicion.x,
      y: e.clientY - posicion.y,
    };

    document.addEventListener('mousemove', manejarMouseMove);
    document.addEventListener('mouseup', manejarMouseUp);
  }

  function manejarMouseMove(e) {
    if (!arrastrando.current) return;

    setPosicion({
      x: e.clientX - offset.current.x,
      y: e.clientY - offset.current.y,
    });
  }

  async function manejarMouseUp(e) {
    arrastrando.current = false;
    document.removeEventListener('mousemove', manejarMouseMove);
    document.removeEventListener('mouseup', manejarMouseUp);

    const nuevaX = e.clientX - offset.current.x;
    const nuevaY = e.clientY - offset.current.y;

    try {
      await api.patch(`/notas/${nota.id}/posicion`, {
        posicion_x: nuevaX,
        posicion_y: nuevaY,
      });
    } catch (error) {
      console.error('Error al guardar posición', error);
    }
  }

  async function guardarCambios() {
    try {
      const respuesta = await api.put(`/notas/${nota.id}`, { titulo, texto, estado });
      onActualizar(respuesta.data);
    } catch (error) {
      console.error('Error al guardar', error);
    }
  }

  async function eliminar() {
    try {
      await api.delete(`/notas/${nota.id}`);
      onEliminar(nota.id);
    } catch (error) {
      console.error('Error al eliminar', error);
    }
  }

  return (
    <div
      onMouseDown={manejarMouseDown}
      className="sticky-note"
      style={{
        position: 'absolute',
        left: posicion.x,
        top: posicion.y,
        width: 220,
        padding: 12,
        backgroundColor: COLORES_ESTADO[estado] || '#fff',
        borderRadius: 6,
        boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
        cursor: 'grab',
      }}
    >
      <input
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        style={{ width: '100%', fontWeight: 'bold', marginBottom: 6, border: 'none', background: 'transparent' }}
      />

      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={3}
        style={{ width: '100%', resize: 'none', border: 'none', background: 'transparent' }}
      />

      <select
        value={estado}
        onChange={(e) => setEstado(e.target.value)}
        style={{ width: '100%', marginBottom: 6 }}
      >
        <option value="pendiente">Pendiente</option>
        <option value="en_curso">En curso</option>
        <option value="hecho">Hecho</option>
      </select>

      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={guardarCambios} style={{ flex: 1 }}>Guardar</button>
        <button onClick={eliminar} style={{ flex: 1 }}>Eliminar</button>
      </div>
    </div>
  );
}
