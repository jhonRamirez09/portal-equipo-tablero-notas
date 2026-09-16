import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from './api';
import { useAuth } from './AuthContext';

export default function Login() {
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  async function manejarSubmit(e) {
    e.preventDefault(); // evita que la página se recargue al enviar el formulario
    setError('');

    try {
      const respuesta = await api.post('/login', { correo, password });
      login(respuesta.data.token, respuesta.data.usuario);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión');
    }
  }

  return (
    <div className="login-card" style={{ maxWidth: 350, margin: '80px auto', padding: 24, background: 'white', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      <h2>Iniciar sesión</h2>

      <form onSubmit={manejarSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>Correo</label><br />
          <input
            type="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            required
            style={{ width: '100%', padding: 8 }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Contraseña</label><br />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: 8 }}
          />
        </div>

        {error && <p style={{ color: 'red' }}>{error}</p>}

        <button type="submit" style={{ width: '100%', padding: 10 }}>
          Entrar
        </button>
      </form>

      <hr style={{ margin: '20px 0' }} />
      <p style={{ fontSize: 12, color: '#666' }}>
        Cuentas demo:<br />
        admin@demo.com / Demo1234<br />
        usuario@demo.com / Demo1234
      </p>
    </div>
  );
}
