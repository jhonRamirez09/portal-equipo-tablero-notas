import { useState, useRef } from 'react';
import api, { mensajeDeError } from './api';

const COLORES_ESTADO = {
  pendiente: '#fff3cd',
  en_curso: '#cfe2ff',
  hecho: '#d1e7dd',
};

function formatearFecha(iso) {
  return new Date(iso).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
}

export default function Nota({ nota, onActualizar, onEliminar, onRecargar }) {
  const [titulo, setTitulo] = useState(nota.titulo);
  const [texto, setTexto] = useState(nota.texto || '');
  const [estado, setEstado] = useState(nota.estado);
  const [posicion, setPosicion] = useState({ x: nota.posicion_x, y: nota.posicion_y });
  const [mensaje, setMensaje] = useState(null); // { texto, recargar }
  const [guardando, setGuardando] = useState(false);
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
      setMensaje({
        texto: mensajeDeError(error),
        recargar: error.response?.status === 404,
      });
    }
  }

  // Validación en el frontend (el backend repite las mismas reglas)
  function validarLocal() {
    if (titulo.trim().length === 0) return 'El título es obligatorio';
    if (titulo.trim().length > 200) return 'El título no puede superar 200 caracteres';
    if (texto.length > 2000) return 'El texto no puede superar 2000 caracteres';
    return '';
  }

  async function guardarCambios() {
    setMensaje(null);

    const errorLocal = validarLocal();
    if (errorLocal) {
      setMensaje({ texto: errorLocal, recargar: false });
      return;
    }

    setGuardando(true);
    try {
      const respuesta = await api.put(`/notas/${nota.id}`, {
        titulo,
        texto,
        estado,
        version: nota.version, // la versión que el usuario vio al abrir la nota
      });
      onActualizar(respuesta.data);
    } catch (error) {
      const status = error.response?.status;
      // 409 = alguien más editó antes, 404 = la nota ya no existe:
      // en ambos casos se ofrece recargar la información actualizada
      setMensaje({
        texto: mensajeDeError(error),
        recargar: status === 409 || status === 404,
      });
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    if (!window.confirm('¿Eliminar esta nota?')) return;
    setMensaje(null);
    try {
      await api.delete(`/notas/${nota.id}`);
      onEliminar(nota.id);
    } catch (error) {
      if (error.response?.status === 404) {
        onEliminar(nota.id); // ya no existía: la quitamos de la pantalla
        return;
      }
      setMensaje({ texto: mensajeDeError(error), recargar: false });
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
        maxLength={200}
        style={{ width: '100%', fontWeight: 'bold', marginBottom: 6, border: 'none', background: 'transparent' }}
      />

      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        maxLength={2000}
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
        <button onClick={guardarCambios} disabled={guardando} style={{ flex: 1 }}>
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
        <button onClick={eliminar} style={{ flex: 1 }}>Eliminar</button>
      </div>

      {mensaje && (
        <div style={{ marginTop: 8, padding: 6, background: '#f8d7da', color: '#842029', borderRadius: 4, fontSize: 12 }}>
          {mensaje.texto}
          {mensaje.recargar && (
            <div style={{ marginTop: 4 }}>
              <button onClick={onRecargar}>Recargar notas</button>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 8, fontSize: 11, color: '#555' }}>
        Creada por {nota.creado_por_nombre}
        <br />
        Modificada por {nota.modificado_por_nombre} · {formatearFecha(nota.actualizado_en)}
      </div>
    </div>
  );
}