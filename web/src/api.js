import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  timeout: 10000,
});

// Antes de cada petición, si hay un token guardado, lo agrega automáticamente
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Si la sesión venció o la cuenta fue desactivada, cerramos sesión.
// El login y el cambio de contraseña se excluyen: un 401 ahí solo significa
// "contraseña incorrecta".
api.interceptors.response.use(
  (respuesta) => respuesta,
  (error) => {
    const url = error.config?.url || '';
    const status = error.response?.status;
    const mensaje = error.response?.data?.error;
    const esLogin = url.includes('/login');
    const esCambioPassword = url.includes('/cambiar-password');
    const sesionInvalida =
      (status === 401 && !esLogin && !esCambioPassword) ||
      (status === 403 && mensaje === 'Tu cuenta fue desactivada');

    if (sesionInvalida) {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Convierte cualquier error en un mensaje claro para el usuario
export function mensajeDeError(error) {
  if (!error.response) {
    return 'No se pudo conectar con el servidor. Intenta de nuevo en unos momentos.';
  }
  const { status, data } = error.response;
  if (data?.error) return data.error;
  if (status === 403) return 'No tienes permisos para realizar esta operación';
  if (status === 404) return 'El recurso ya no existe';
  return 'Ocurrió un error inesperado';
}

export default api;