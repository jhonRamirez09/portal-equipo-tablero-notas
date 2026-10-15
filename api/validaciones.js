function validarPasswordNueva(password) {
  if (typeof password !== 'string') return 'La contraseña es obligatoria';
  if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
  if (password.length > 72) return 'La contraseña no puede superar 72 caracteres';
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'La contraseña debe incluir mayúscula, minúscula y número';
  }
  return null;
}

function validarCorreo(correo) {
  if (typeof correo !== 'string') return 'El correo es obligatorio';
  const limpio = correo.trim();
  if (limpio.length === 0 || limpio.length > 100) return 'El correo debe tener entre 1 y 100 caracteres';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio)) return 'El correo no tiene un formato válido';
  return null;
}

function validarNombre(nombre) {
  if (typeof nombre !== 'string') return 'El nombre es obligatorio';
  const limpio = nombre.trim();
  if (limpio.length === 0 || limpio.length > 100) return 'El nombre debe tener entre 1 y 100 caracteres';
  return null;
}

module.exports = { validarPasswordNueva, validarCorreo, validarNombre };