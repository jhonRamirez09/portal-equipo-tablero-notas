import { useState } from 'react';
import api, { mensajeDeError } from './api';

export default function CambiarPassword() {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [enviando, setEnviando] = useState(false);

  function validarLocal() {
    if (!actual) return 'Escribe tu contraseña actual';
    if (nueva.length < 8) return 'La contraseña nueva debe tener al menos 8 caracteres';
    if (nueva.length > 72) return 'La contraseña nueva no puede superar 72 caracteres';
    if (!/[a-z]/.test(nueva) || !/[A-Z]/.test(nueva) || !/[0-9]/.test(nueva)) {
      return 'La contraseña nueva debe incluir mayúscula, minúscula y número';
    }
    if (nueva !== confirmar) return 'La confirmación no coincide con la contraseña nueva';
    if (actual === nueva) return 'La contraseña nueva debe ser distinta a la actual';
    return '';
  }

  async function manejarSubmit(e) {
    e.preventDefault();
    setError('');
    setExito('');

    const errorLocal = validarLocal();
    if (errorLocal) {
      setError(errorLocal);
      return;
    }

    setEnviando(true);
    try {
      await api.put('/cambiar-password', {
        password_actual: actual,
        password_nueva: nueva,
      });
      setExito('Contraseña actualizada correctamente');
      setActual('');
      setNueva('');
      setConfirmar('');
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  }

  const estiloCampo = { marginBottom: 12 };
  const estiloInput = { width: '100%', padding: 8 };

  return (
    <div className="password-page" style={{ maxWidth: 350 }}>
      <h2>Cambiar contraseña</h2>

      <form onSubmit={manejarSubmit}>
        <div style={estiloCampo}>
          <label>Contraseña actual</label><br />
          <input type="password" value={actual} onChange={(e) => setActual(e.target.value)} style={estiloInput} />
        </div>
        <div style={estiloCampo}>
          <label>Contraseña nueva</label><br />
          <input type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} style={estiloInput} />
        </div>
        <div style={estiloCampo}>
          <label>Confirmar contraseña nueva</label><br />
          <input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} style={estiloInput} />
        </div>

        {error && <p style={{ color: 'red' }}>{error}</p>}
        {exito && <p style={{ color: 'green' }}>{exito}</p>}

        <button type="submit" disabled={enviando} style={{ width: '100%', padding: 10 }}>
          {enviando ? 'Guardando...' : 'Guardar'}
        </button>
      </form>

      <p style={{ marginTop: 16 }}>
        <a href="/tablero">Volver al tablero</a>
      </p>
    </div>
  );
}
