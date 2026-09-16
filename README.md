# Portal de equipo con tablero de notas

Aplicación web para que un equipo gestione usuarios y organice notas en un tablero
compartido tipo post-it, con dashboard de métricas calculado mediante AWS Lambda.

# Tiempo empleado

7 horas 3 minutos

## Requisitos

- Docker Desktop (con Docker Compose)
- AWS SAM CLI (solo para correr la Lambda de métricas en local)
- Node.js 20+ (opcional, solo si quieres correr algo fuera de Docker)

## Comandos de arranque (local)

Se necesitan **dos terminales** abiertas al mismo tiempo, ambas desde la raíz del proyecto.

**Terminal 1 — base de datos, API y frontend:**

docker compose up --build

Esto levanta tres contenedores:

- `portal_db` (PostgreSQL, puerto 5432)
- `portal_api` (API Express, puerto 3000)
- `portal_web` (frontend React servido con nginx, puerto 5173)

**Terminal 2 — Lambda de métricas:**
sam local start-api --parameter-overrides DatabaseUrl="postgresql://portal_user:portal_pass@host.docker.internal:5432/portal_db" --docker-network portal-equipo_default --port 3001

Esto levanta la funcionalidad de las metricas

**Con ambas terminales corriendo, abre el navegador en:**

http://localhost:5173

## Cuentas de demostración

Se cargan automáticamente al crear la base de datos por primera vez (ver sección de Persistencia).

| Rol           | Correo           | Contraseña |
| ------------- | ---------------- | ---------- |
| Administrador | admin@demo.com   | Demo1234   |
| Usuario       | usuario@demo.com | Demo1234   |

Un usuario nuevo creado desde la aplicación inicia sesión de la misma forma: con el
correo y la contraseña que el administrador definió al crearlo, desde la pantalla de
Administración.

## Instrucciones de uso

1. Inicia sesión con cualquiera de las cuentas demo.
2. **Tablero** (`/tablero`): crea notas con el botón "+ Nueva nota", edita el título,
   texto y estado directamente sobre la nota y confirma con "Guardar". Arrastra la nota
   desde cualquier parte de su borde para moverla; la posición se guarda sola al soltar.
3. **Dashboard** (`/dashboard`): muestra el total de notas y su distribución por estado,
   calculado por la función Lambda. Botón "Actualizar" para refrescar los datos.
4. **Administración** (`/admin`, solo visible para el rol Administrador): permite listar
   usuarios, crear usuarios nuevos asignando su rol, y activar/desactivar usuarios
   existentes. El sistema impide desactivar al último administrador activo.

Diferencia entre roles: un Usuario normal solo ve "Tablero" y "Dashboard". Un
Administrador ve además "Administración", tanto en el menú como en el acceso directo
por URL (si un Usuario intenta entrar a `/admin` escribiendo la URL a mano, es
redirigido automáticamente al dashboard).

## Funcionamiento de la persistencia

- Los datos de PostgreSQL se guardan en un volumen de Docker (`db_data`), que sobrevive
  a `docker compose down` y a reinicios del contenedor. Los datos solo se pierden si se
  borra el volumen explícitamente (`docker compose down -v`).
- El script `db/init.sql` solo se ejecuta **una vez**, la primera vez que se crea el
  volumen de la base de datos (es decir, la primera vez que corres el proyecto). Ahí se
  crean las tablas y se insertan las dos cuentas demo.
- Las notas del tablero (contenido, estado y posición) se guardan en la tabla `notas` y
  persisten igual que los usuarios: sobreviven a recargar la página y a reiniciar los
  contenedores.

## Arquitectura

**Local (para desarrollo y demo):**

- Frontend: React + Vite, compilado y servido por nginx dentro de un contenedor Docker.
- API: Node.js + Express, dentro de un contenedor Docker, expone `/api/login`,
  `/api/usuarios` y `/api/notas`.
- Base de datos: PostgreSQL dentro de un contenedor Docker, con volumen persistente.
- Lambda de métricas: se ejecuta localmente mediante AWS SAM (`sam local start-api`),
  conectándose directamente a la base de datos para calcular el total de notas y su
  distribución por estado.

**AWS (infraestructura como código en `template.yaml`, no desplegada):**

- **EC2**: corre la imagen Docker de la API (misma imagen que localmente), descargada
  desde Amazon ECR al iniciar la instancia.
- **RDS (PostgreSQL)**: reemplaza al contenedor de base de datos local.
- **Lambda**: la misma función de métricas, ahora expuesta vía API Gateway.
- **S3 + CloudFront**: el frontend compilado (`npm run build`) se sube a un bucket S3
  privado, distribuido globalmente vía CloudFront con HTTPS automático. Las rutas de
  React Router se resuelven mediante `CustomErrorResponses` en CloudFront (403/404
  redirigen a `index.html`).

## Instrucciones de despliegue en AWS

**No fue desplegado** (ver Limitaciones). Los pasos para hacerlo, si se desea:

1. Configurar AWS CLI: `aws configure`
2. Construir y subir la imagen de la API a Amazon ECR (crear el repositorio con
   `aws ecr create-repository --repository-name portal-api`, autenticar Docker con
   `aws ecr get-login-password`, y luego `docker build`, `docker tag`, `docker push`)
3. Ejecutar `deploy.sh` (con Git Bash o WSL en Windows), que pide: la URI de la imagen en
   ECR, el nombre de un par de llaves EC2, la contraseña de la base de datos, y la cadena
   de conexión para la Lambda. Internamente corre `sam build` y `sam deploy --guided`.
4. Subir el frontend compilado al bucket S3 indicado en los `Outputs` del despliegue:

npm run build (dentro de web/)
aws s3 sync web/dist s3://<nombre-del-bucket>

5. La URL final del sitio queda en el output `FrontendUrl` (dominio de CloudFront).

## Instrucciones de retirada en AWS

Ejecutar `destroy.sh` (Git Bash o WSL), indicando el nombre del stack usado en el
despliegue. El script vacía primero el bucket S3 (requisito de AWS para poder borrarlo)
y luego elimina todo el stack de CloudFormation, incluyendo EC2, RDS, Lambda, S3 y
CloudFront.

## Tiempo empleado

Aproximadamente 7 horas y 30 minutos de trabajo efectivo, distribuidas en cuatro
sesiones a lo largo de 2 días calendario.

## Limitaciones y pendientes conocidos

- **No se probó el despliegue real en AWS.** El `template.yaml` fue validado
  sintácticamente con `sam validate` y `sam validate --lint`, pero no se ejecutó
  `sam deploy` contra una cuenta real, para evitar incurrir en costos y por estar
  todavía profundizando en los servicios de AWS involucrados.
- **La contraseña de la base de datos (RDS) se pasa como parámetro de CloudFormation**
  en lugar de usar AWS Secrets Manager con referencias dinámicas (recomendación que
  arrojó `cfn-lint`). En un entorno productivo real, se gestionaría con Secrets Manager.
- **Cualquier usuario activo puede editar o eliminar cualquier nota del tablero**,
  incluidas las creadas por otros usuarios. Esto es una implementación literal del
  enunciado ("Todos los usuarios activos pueden crear, editar, mover y eliminar todas
  las notas del tablero"). Para un proyecto real, sería recomendable restringir la
  eliminación al creador de la nota o a un administrador; se evaluó implementarlo pero
  se decidió mantener el comportamiento tal como se especifica.
- **La administración de usuarios no permite editar el nombre de un usuario ya creado
  desde la interfaz** (el backend sí lo soporta en `PUT /api/usuarios/:id`, pero no está
  expuesto en la pantalla de Administración) **ni eliminar usuarios** (solo activar o
  desactivar). Se consideraron ambas mejoras pero se priorizó el resto del alcance
  dentro del tiempo disponible.
