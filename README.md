# Portal de equipo con tablero de notas

Aplicación web para que un equipo gestione usuarios y organice notas en un tablero
compartido tipo post-it. Incluye autenticación con roles, búsqueda y filtros, control de
modificaciones simultáneas, historial de actividad, un dashboard de métricas calculado por
una función Lambda y pruebas automatizadas. Todo se ejecuta en local con Docker Compose, sin
cuenta de AWS ni servicios de pago.

## Contenido

1. [Requisitos](#1-requisitos)
2. [Instalación y ejecución](#2-instalación-y-ejecución)
3. [Cuentas de demostración, roles y permisos](#3-cuentas-de-demostración-roles-y-permisos)
4. [Arquitectura y comunicación entre componentes](#4-arquitectura-y-comunicación-entre-componentes)
5. [Endpoints principales](#5-endpoints-principales)
6. [Seguridad](#6-seguridad)
7. [Control de modificaciones simultáneas](#7-control-de-modificaciones-simultáneas)
8. [Historial de actividad](#8-historial-de-actividad)
9. [Dashboard y métricas (Lambda)](#9-dashboard-y-métricas-lambda)
10. [Pruebas automatizadas](#10-pruebas-automatizadas)
11. [Persistencia, detener y reiniciar](#11-persistencia-detener-y-reiniciar)
12. [Despliegue en AWS (opcional, no requerido)](#12-despliegue-en-aws-opcional-no-requerido)
13. [Limitaciones y pendientes](#13-limitaciones-y-pendientes)
14. [Registro de entrega](#14-registro-de-entrega)

---

## 1. Requisitos

- **Docker Desktop** con Docker Compose v2 (comando `docker compose`).
- Puertos libres en el equipo: **3000** (API), **3001** (Lambda local), **5173** (web) y
  **5432** (base de datos).
- No se necesita instalar Node.js, PostgreSQL ni AWS SAM CLI: todo corre dentro de contenedores.

## 2. Instalación y ejecución

Desde la raíz del proyecto:

**1. Crear el archivo de configuración.** El archivo `.env` no se sube al repositorio; se crea
a partir de la plantilla, que ya trae valores de demostración que funcionan sin editar nada.

- Windows (PowerShell o CMD): `copy .env.example .env`
- Linux / macOS: `cp .env.example .env`

**2. Levantar todo:**

```
docker compose up --build
```

La primera vez tarda unos minutos (descarga imágenes e instala dependencias). Se levantan
cuatro contenedores:

| Contenedor      | Qué es                                          | Puerto                                       |
| --------------- | ----------------------------------------------- | -------------------------------------------- |
| `portal_db`     | PostgreSQL 16 (con volumen persistente)         | 5432 (solo accesible desde el propio equipo) |
| `portal_api`    | API REST (Node.js + Express)                    | 3000                                         |
| `portal_lambda` | Emulador local de la función Lambda de métricas | 3001                                         |
| `portal_web`    | Frontend React servido por nginx                | 5173                                         |

La API y la Lambda esperan a que la base de datos esté lista (`healthy`) antes de arrancar.

**3. Abrir** <http://localhost:5173> e iniciar sesión con una cuenta de demostración.

Para ejecutarlo en segundo plano usa `docker compose up -d --build` y comprueba el estado con
`docker compose ps`. Si falta alguna variable en `.env`, Docker Compose se detiene con un mensaje
que indica cuál.

### Configuración (`.env`)

| Variable            | Uso                                               |
| ------------------- | ------------------------------------------------- |
| `POSTGRES_USER`     | Usuario de la base de datos                       |
| `POSTGRES_PASSWORD` | Contraseña de la base de datos                    |
| `POSTGRES_DB`       | Nombre de la base de datos                        |
| `JWT_SECRET`        | Secreto con el que se firman los tokens de sesión |

- El archivo `.env` está en `.gitignore`; la configuración sensible no queda en el repositorio.
- Para generar un secreto propio y aleatorio:
  `docker run --rm node:20-alpine node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Usa solo letras, números y guion bajo en la contraseña de la base de datos (va dentro de una URL).
- La contraseña de la base de datos solo se aplica cuando se crea el volumen por primera vez. Si
  la cambias después, hay que recrear el volumen (ver sección 11).
- Los valores de `.env.example` son solo para demostración y deben cambiarse en cualquier uso real.

### Cambios en el código

- **Frontend (`web/`)**: se compila dentro de la imagen; tras modificarlo ejecuta
  `docker compose up -d --build web`.
- **API (`api/`)**: el código está montado como volumen y corre con `nodemon`, así que se
  recarga al guardar. Si no detecta el cambio, usa `docker compose restart api`.

## 3. Cuentas de demostración, roles y permisos

Se crean automáticamente la primera vez que se levanta la base de datos (`db/init.sql`), junto
con tres notas de ejemplo.

| Rol           | Correo             | Contraseña |
| ------------- | ------------------ | ---------- |
| Administrador | `admin@demo.com`   | `Demo1234` |
| Usuario       | `usuario@demo.com` | `Demo1234` |

Requisitos de toda contraseña nueva: de 8 a 72 caracteres, con al menos una mayúscula, una
minúscula y un número.

| Operación                                             | Usuario | Administrador |
| ----------------------------------------------------- | :-----: | :-----------: |
| Iniciar y cerrar sesión, cambiar su propia contraseña |   Sí    |      Sí       |
| Ver, crear, editar, mover y eliminar notas            |   Sí    |      Sí       |
| Buscar y filtrar notas                                |   Sí    |      Sí       |
| Ver el dashboard de métricas                          |   Sí    |      Sí       |
| Consultar el historial de las notas                   |   Sí    |      Sí       |
| Consultar el historial general (incluye usuarios)     |   No    |      Sí       |
| Listar, crear y editar usuarios; activar y desactivar |   No    |      Sí       |
| Modificar o eliminar registros del historial          |   No    |      No       |

- Todos los usuarios activos pueden editar y eliminar cualquier nota del tablero (así lo define el enunciado).
- **Siempre debe existir al menos un administrador activo**: el sistema no permite desactivar
  ni quitar el rol al último.
- Los permisos se validan en el servidor en cada petición; ocultar opciones en la pantalla es
  solo una ayuda visual. El rol y el estado (activo/inactivo) se leen de la base de datos en
  cada petición, no del token, así que un cambio de rol o una desactivación tienen efecto inmediato.

## 4. Arquitectura y comunicación entre componentes

```
Navegador (React, http://localhost:5173)
   │
   ├── Notas, usuarios, historial, login ──► API Express (http://localhost:3000/api) ──┐
   │        (axios + token JWT en la cabecera Authorization)                           │
   │                                                                                   ▼
   └── Métricas del dashboard ───────────► Lambda local (http://localhost:3001/metricas) ──► PostgreSQL
            (el mismo token JWT)                  (lee las notas directamente)        (volumen db_data)
```

- **Frontend → API:** el frontend usa `axios` (`web/src/api.js`) con la URL base
  `http://localhost:3000/api`. Un interceptor añade el token `Authorization: Bearer <token>` a cada
  petición y cierra la sesión si el servidor indica que el token venció o la cuenta fue desactivada.
  Los errores se traducen a mensajes claros (API caída, sin permisos, conflicto, nota inexistente...).
- **Frontend → Lambda:** el dashboard llama directamente a `http://localhost:3001/metricas`
  con el mismo token.
- **Lambda → datos:** la función se conecta a PostgreSQL con `DATABASE_URL`, lee las notas
  (con el nombre de su creador) y calcula las métricas. No usa valores estáticos ni datos
  guardados en el navegador.
- **API → base de datos:** consultas parametrizadas (nunca se concatena texto del usuario en el
  SQL) con el cliente `pg`.

Estructura del proyecto:

```
api/       API Express (app.js, rutas-*.js, middleware.js, historial.js, validaciones.js) y pruebas en api/test/
lambda/    Función de métricas: handler.js, metricas.js (cálculo puro), local-server.js (emulador) y pruebas en lambda/test/
web/       Frontend React + Vite (servido con nginx)
db/        init.sql (esquema y datos de demostración)
template.yaml, deploy.sh, destroy.sh   Despliegue opcional en AWS
```

## 5. Endpoints principales

Todos requieren `Authorization: Bearer <token>`, salvo `login` y `health`.

**Autenticación**

| Método y ruta               | Descripción                                                         |
| --------------------------- | ------------------------------------------------------------------- |
| `POST /api/login`           | Inicia sesión; devuelve token (8 h de vigencia) y datos del usuario |
| `PUT /api/cambiar-password` | Cambia la contraseña propia (`password_actual`, `password_nueva`)   |
| `GET /api/health`           | Comprobación de estado (sin autenticación)                          |

**Notas**

| Método y ruta                        | Descripción                                                                                    |
| ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `GET /api/notas?q=&estado=&creador=` | Lista con búsqueda por título y contenido y filtros combinables; sin parámetros devuelve todas |
| `GET /api/notas/creadores`           | Usuarios que han creado notas (para el filtro de creador)                                      |
| `POST /api/notas`                    | Crea una nota                                                                                  |
| `PUT /api/notas/:id`                 | Edita título, texto y estado; **exige `version`** (ver sección 7)                              |
| `PATCH /api/notas/:id/posicion`      | Mueve la nota (no cambia su versión)                                                           |
| `DELETE /api/notas/:id`              | Elimina la nota                                                                                |

**Usuarios (solo administrador)**

| Método y ruta                    | Descripción                               |
| -------------------------------- | ----------------------------------------- |
| `GET /api/usuarios`              | Lista usuarios                            |
| `POST /api/usuarios`             | Crea un usuario                           |
| `PUT /api/usuarios/:id`          | Edita nombre, correo y rol                |
| `PATCH /api/usuarios/:id/estado` | Activa o desactiva (`activo: true/false`) |

**Historial y métricas**

| Método y ruta                                                 | Descripción                                           |
| ------------------------------------------------------------- | ----------------------------------------------------- |
| `GET /api/historial?tipo_recurso=&recurso_id=&limite=&desde=` | Consulta de eventos (más recientes primero, paginada) |
| `GET http://localhost:3001/metricas`                          | Métricas del dashboard (función Lambda)               |

**Códigos HTTP:** `200` correcto, `201` creado, `204` eliminado, `400` datos inválidos,
`401` sin sesión o token inválido/vencido, `403` sin permisos o cuenta desactivada, `404` recurso
inexistente, `409` conflicto (correo repetido o nota modificada por otra persona), `500` error del servidor.

**Manejo de errores:** las respuestas de error son siempre un JSON con un mensaje claro
(`{"error": "..."}`). Los detalles internos (mensajes de la base de datos, rastros de pila)
se escriben solo en el registro del servidor y nunca se devuelven al cliente. Un JSON mal formado
responde `400` y una ruta inexistente responde `404`, también sin detalles internos.

## 6. Seguridad

- **Contraseñas:** se guardan con hash `bcrypt` (nunca en texto plano); no se devuelven en ninguna respuesta.
- **Sesiones:** token JWT con vencimiento de 8 horas. En cada petición protegida se consulta
  la base de datos: si la cuenta fue desactivada o el usuario ya no existe, se rechaza (`403`)
  aunque el token siga vigente.
- **Permisos en el servidor:** middleware de autenticación y de administrador en cada ruta protegida.
- **Validación de entradas:** todos los datos que recibe la API se validan antes de procesarlos
  (tipos, longitudes, formato de correo, estados permitidos, requisitos de contraseña). El frontend
  repite las reglas para dar mensajes inmediatos, pero la validación que cuenta es la del servidor.
  - Notas: título obligatorio de hasta 200 caracteres; texto de hasta 2000.
- **Inyección SQL:** todas las consultas son parametrizadas; en la búsqueda, los caracteres `%` y `_` se tratan como texto.
- **Configuración sensible:** en variables de entorno (`.env`), fuera del repositorio.
- **Mensajes de login:** un correo inexistente y una contraseña incorrecta devuelven el mismo mensaje.

## 7. Control de modificaciones simultáneas

Se usa un **campo de versión incremental** (`notas.version`, empieza en 1):

1. Al listar las notas, cada una trae su `version`. Esa es la versión que el usuario "vio".
2. Al guardar (`PUT /api/notas/:id`), el cliente envía la `version` que vio.
3. El servidor actualiza con una sola sentencia condicional:
   `UPDATE notas SET ..., version = version + 1 WHERE id = $id AND version = $version`.
   Como la comprobación y el cambio ocurren en la misma sentencia, dos guardados simultáneos
   no pueden pisarse: uno gana y el otro no encuentra la versión esperada.
4. Si no se actualizó ninguna fila, se responde `409 Conflict` con un mensaje claro y no se
   modifica nada. En pantalla, la nota muestra el aviso con el botón **"Recargar notas"**, que
   trae la información actualizada antes de volver a guardar.
5. Si la nota fue eliminada, se responde `404` ("La nota ya no existe") y también se ofrece recargar.

Mover una nota por el tablero (`PATCH .../posicion`) no cambia la versión, para que arrastrar
no provoque conflictos falsos con quien está editando el texto.

Las fechas de creación y de última modificación, y los usuarios que crearon y modificaron cada
nota, los genera el servidor; el cliente no puede fijarlos.

## 8. Historial de actividad

Tabla `historial`, almacenada de forma persistente en la base de datos. Cada registro contiene:
identificador del evento, tipo de operación, usuario que la realizó, fecha y hora, tipo e
identificador del recurso afectado, y un resumen del cambio.

Eventos registrados: `creacion_nota`, `edicion_nota`, `cambio_estado_nota`, `eliminacion_nota`,
`creacion_usuario`, `edicion_usuario`, `desactivacion_usuario`, `reactivacion_usuario` y
`cambio_password`.

- **Se conserva aunque se elimine la nota:** `recurso_id` es un número, no una llave foránea, y el
  resumen guarda el título. Al eliminar una nota, su historial sigue disponible.
- **Solo lectura:** la API solo expone la consulta; no existen rutas para crear, modificar o borrar registros.
- **Permisos:** un usuario normal consulta únicamente el historial de notas; el administrador, el general.
- **Sin secretos:** los resúmenes nunca incluyen contraseñas, tokens ni otros datos sensibles
  (el cambio de contraseña solo registra que ocurrió).
- En la aplicación: pantalla **Historial**, con filtros y paginación.

## 9. Dashboard y métricas (Lambda)

La función está en `lambda/` y tiene responsabilidades separadas:

| Archivo           | Responsabilidad                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------- |
| `metricas.js`     | Cálculo puro de las métricas a partir de una lista de notas (sin base de datos)                       |
| `handler.js`      | Valida el token y que el usuario siga activo, lee las notas y responde                                |
| `local-server.js` | Emulador local de API Gateway: convierte peticiones HTTP en eventos y llama al **mismo** `handler.js` |

Métricas que entrega (`GET /metricas`):

- Total de notas.
- Cantidad y porcentaje de notas por estado (pendiente, en curso, hecho).
- Notas creadas en los últimos 7 días y notas modificadas en los últimos 7 días
  (una nota recién creada cuenta como modificada; mover una nota en el tablero no cuenta).
- Notas creadas por usuario.
- Fecha y hora de la última actualización de las métricas (momento en que se calcularon).

Se calculan a partir de los datos persistidos cada vez que se consulta; el botón **Actualizar** del dashboard vuelve a pedirlas.

- **Errores controlados:** sin token o token inválido `401`, cuenta desactivada `403`, fallo de datos `500` con
  un mensaje genérico (el detalle solo va al registro). Si la configuración está incompleta, también `500`.
- **Estado de carga y errores en pantalla:** el dashboard muestra "Cargando métricas..." y, si no se pueden
  obtener, un mensaje comprensible.
- **Sin AWS:** el emulador local sustituye a API Gateway + Lambda. El mismo `handler.js` es el que
  usa `template.yaml` en un despliegue real.

## 10. Pruebas automatizadas

Con los contenedores levantados (`docker compose up -d`):

```
docker compose exec api npm test              # 72 pruebas de la API
docker compose run --rm lambda npm test       # 10 pruebas de la Lambda
```

- Las pruebas de la API usan una **base de datos aparte** (`portal_test`), que se crea sola con el
  esquema de `db/init.sql`; no tocan los datos de la aplicación. Corren en serie porque comparten esa base.
- Las pruebas de la Lambda no necesitan base de datos (usan datos simulados).

| Área                                           | Dónde                                              |
| ---------------------------------------------- | -------------------------------------------------- |
| 1. Inicio de sesión válido e inválido          | `api/test/01-login.test.js`                        |
| 2. Restricciones de acceso según el rol        | `api/test/02-permisos.test.js`                     |
| 3. Validación de datos al crear y editar notas | `api/test/03-validacion-notas.test.js`             |
| 4. Búsqueda y combinación de filtros           | `api/test/04-filtros.test.js`                      |
| 5. Detección de conflictos de edición          | `api/test/05-concurrencia.test.js`                 |
| 6. Registro de eventos en el historial         | `api/test/06-historial.test.js`                    |
| 7. Cálculo de las métricas del dashboard       | `lambda/test/metricas.test.js` y `handler.test.js` |
| 8. Protección del último administrador activo  | `api/test/07-ultimo-admin.test.js`                 |

**Qué cubren:** el comportamiento de la API de extremo a extremo contra una base de datos PostgreSQL real
(incluidas sesiones vencidas, usuarios desactivados, cambio de rol, escrituras simultáneas, que el historial
no guarde secretos y que sobreviva al borrado de una nota), y la lógica y el manejo de errores de la Lambda.

**Limitaciones:**

- No hay pruebas automatizadas del frontend; la interfaz se verificó manualmente.
- Son pruebas de integración y necesitan el contenedor de la base de datos en ejecución.
- Las pruebas de concurrencia comprueban que nunca se pierde un cambio y que la regla del último
  administrador se mantiene bajo operaciones simultáneas, pero no pueden demostrar que no existan otros casos raros.
- El despliegue en AWS no se prueba automáticamente.

## 11. Persistencia, detener y reiniciar

Los datos de PostgreSQL se guardan en el volumen de Docker `db_data`, que sobrevive a detener y
reiniciar los contenedores. `db/init.sql` (esquema y datos de demostración) se ejecuta **una sola vez**,
cuando el volumen se crea.

**Detener sin perder datos:**

```
docker compose stop        # detiene los contenedores
docker compose down        # los detiene y elimina (el volumen y sus datos se conservan)
```

**Volver a levantar** (los datos siguen ahí):

```
docker compose up -d
```

**Comprobarlo:** crea o edita una nota, ejecuta `docker compose down`, luego `docker compose up -d`, inicia
sesión de nuevo y verifica que la nota, los usuarios y el historial siguen igual.

**Reiniciar desde cero (borra todos los datos y recarga los de demostración):**

```
docker compose down -v
docker compose up --build
```

## 12. Despliegue en AWS (opcional, no requerido)

La ejecución local no depende de AWS. El archivo `template.yaml` describe una arquitectura de
referencia (EC2 para la API, RDS PostgreSQL, Lambda + API Gateway para las métricas, S3 + CloudFront
para el frontend), con los scripts `deploy.sh` y `destroy.sh`. **No se desplegó ni se volvió a validar
durante la Parte 2** (ver limitaciones). Los secretos (`JwtSecret`, contraseña de RDS) se reciben
como parámetros y no están escritos en la plantilla.

## 13. Limitaciones y pendientes

- **Despliegue en AWS sin probar:** `template.yaml` no se desplegó, y tras los cambios de la Parte 2
  (parámetro `JwtSecret`, validación del token en la Lambda) no se volvió a validar ni se actualizó `deploy.sh`.
  La contraseña de RDS se pasa como parámetro de CloudFormation; en producción se usaría AWS Secrets Manager.
  El grupo de seguridad de la EC2 deja abierto el puerto 22 a cualquier dirección.
- **Modo desarrollo:** la API corre con `nodemon` y el código montado como volumen; no hay HTTPS ni
  configuración de producción. CORS está abierto a cualquier origen.
- **URLs fijas:** el frontend apunta a `http://localhost:3000` y `http://localhost:3001`
  (escritas en `web/src/api.js` y `web/src/Dashboard.jsx`); en otro entorno habría que cambiarlas y reconstruir.
- **Sesiones:** el token (8 h) se guarda en el almacenamiento local del navegador y no hay lista de revocación
  (aunque la desactivación de una cuenta sí surte efecto de inmediato). No hay protección contra intentos
  repetidos de inicio de sesión (límite de intentos) ni recuperación de contraseña.
- **Historial no atómico:** el registro del historial se escribe justo después de la operación y no dentro de la
  misma transacción; si fallara, el error queda en el registro del servidor y la operación no se revierte.
- **Notas:** cualquier usuario activo puede editar o eliminar cualquier nota (según el enunciado). El tablero
  carga todas las notas sin paginación. Ante un conflicto de edición el usuario debe recargar y volver a aplicar su
  cambio; no hay pantalla de comparación o fusión.
- **Administración de usuarios:** desde la interfaz no se puede editar el nombre ni el correo de un usuario ya
  creado (la API sí lo permite), ni eliminar usuarios ni restablecer contraseñas ajenas.
- **Métricas:** la Lambda trae todas las notas y calcula en memoria; con muchos datos convendría agruparlos en SQL.
  Las fechas se muestran en la zona horaria del navegador.
- **Pruebas:** sin pruebas automatizadas del frontend ni del despliegue.
- **Dependencias:** `npm install` informa vulnerabilidades en dependencias de desarrollo (herramientas de
  pruebas y de compilación); no se han tratado.
- **Valores de demostración:** las cuentas demo y los valores de `.env.example` son solo para pruebas.

## 14. Registro de entrega

- **Versión entregada (commit):** `COMPLETAR_CON_EL_HASH_DEL_COMMIT`
- **Tiempo efectivo empleado en la Parte 2:** 7 horas 40 minutos
- **Funcionalidades pendientes:** ver la sección 13 (Limitaciones y pendientes).
