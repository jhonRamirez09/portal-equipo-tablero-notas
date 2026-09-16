# Portal de equipo con tablero de notas

Aplicación web para que un equipo gestione usuarios y organice notas en un tablero
compartido tipo post-it, con dashboard de métricas calculado mediante AWS Lambda.

## Requisitos

- Docker Desktop (con Docker Compose)
- AWS SAM CLI (solo para correr la Lambda de métricas en local)
- Node.js 20+ (opcional, solo si quieres correr algo fuera de Docker)

## Comandos de arranque (local)

Se necesitan **dos terminales** abiertas al mismo tiempo, ambas desde la raíz del proyecto.

**Terminal 1 — base de datos, API y frontend:**
