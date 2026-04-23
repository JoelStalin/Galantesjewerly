# GitHub Secrets Guide

GitHub no debe ser la fuente de verdad de las credenciales operativas. La referencia actual para producción es la VM de GCP con `docker-compose.production.yml` y un `.env.prod` que vive solo en el servidor.

Usa secretos de GitHub solo si activas o mantienes despliegues por GitHub Actions. Si no hay workflow que los necesite, no dupliques secretos en GitHub.

## Qué sí puede vivir en GitHub

- Archivos plantilla: `.env.example`, `.env.gcp.example`, `.env.prod.example`, `.env.test.example`, `odoo/.env.example`
- Documentación que explique dónde conseguir cada valor
- Variables públicas o no sensibles, como nombres de host o nombres de proyecto

## Qué no debe vivir en GitHub

- `.env.prod`, `.env.gcp`, `.env.test`, `odoo/.env`
- Passwords de admin, Postgres u Odoo
- API keys de SendGrid, Meta o Cloudflare
- Client secrets de Google OAuth
- Private keys de service accounts
- Tokens de túneles de Cloudflare

## Secretos mínimos si usas GitHub Actions

Configúralos en `Settings -> Secrets and variables -> Actions` y pega valores reales solo ahí:

| Nombre | Uso |
| --- | --- |
| `REMOTE_HOST` | Host o IP de la VM de producción |
| `REMOTE_PORT` | Puerto SSH |
| `REMOTE_USER` | Usuario SSH de despliegue |
| `REMOTE_SSH_KEY` | Llave privada para acceder a la VM |
| `REMOTE_APP_DIR` | Ruta del repo en la VM |
| `ENV_PROD_B64` | `.env.prod` codificado en base64, si el workflow lo sube al servidor |

Si el pipeline necesita integraciones adicionales, pásalas a través de `ENV_PROD_B64` o de secretos individuales temporales, pero evita replicar credenciales en múltiples sitios sin necesidad.

## Reglas operativas

1. Mantén los secretos reales solo en la VM de producción y en el gestor que corresponda.
2. Usa archivos `*.example` como contrato de configuración.
3. Si una credencial llegó a GitHub por error, considérala comprometida y rótala.
4. Si hace falta limpiar historial, usa `git filter-repo` y luego `git push --force --all --force-with-lease`.

## Referencia

La guía operativa completa quedó en `docs/deployment/PRODUCTION_SYNC_AND_SECRETS.md`.
