CREATE TABLE usuarios (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  correo VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol VARCHAR(20) NOT NULL CHECK (rol IN ('admin', 'usuario')),
  activo BOOLEAN NOT NULL DEFAULT true,
  creado_en TIMESTAMP DEFAULT NOW()
);

CREATE TABLE notas (
  id SERIAL PRIMARY KEY,
  titulo VARCHAR(200) NOT NULL,
  texto TEXT,
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_curso', 'hecho')),
  posicion_x INTEGER NOT NULL DEFAULT 100,
  posicion_y INTEGER NOT NULL DEFAULT 100,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- Cuentas de demostración
-- Contraseña para ambas: Demo1234
-- (el hash de abajo corresponde a esa contraseña con bcrypt)
INSERT INTO usuarios (nombre, correo, password_hash, rol, activo) VALUES
('Admin Demo', 'admin@demo.com', '$2b$10$NWi08mMJydJtBN6H/qAoyOUuV5WSJhsO9SqZ1B7Apc3Kp3jQ77P4e', 'admin', true),
('Usuario Demo', 'usuario@demo.com', '$2b$10$NWi08mMJydJtBN6H/qAoyOUuV5WSJhsO9SqZ1B7Apc3Kp3jQ77P4e', 'usuario', true);