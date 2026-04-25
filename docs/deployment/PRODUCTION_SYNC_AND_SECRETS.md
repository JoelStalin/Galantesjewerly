# Producción, Sincronización y Secretos

Guía operativa actual para mantener este repositorio alineado con la producción real sin volver a guardar credenciales en GitHub.

## 1. Fuente de verdad actual

La producción activa corre en una VM de GCP y usa:

- `docker-compose.production.yml`
- `.env.prod` solo en el servidor
- servicios `web`, `odoo`, `db`, `nginx`, `cloudflared`

El repo debe contener código, plantillas y documentación. No debe contener secretos reales.

## 2. Resultado de la auditoría del 2026-04-22

Se detectó que Git todavía versionaba estos archivos sensibles:

- `.env.gcp`
- `.env.prod`
- `.env.test`
- `odoo/.env`

Además, había secretos hardcodeados o ejemplos inseguros en:

- `odoo/Dockerfile`
- `odoo/config/odoo.conf`
- `scripts/verify_production_profile9.py`
- `GITHUB_SECRETS_GUIDE.md`

Los archivos críticos del flujo de citas ya coinciden con producción. La sincronización pendiente era de higiene operativa y documentación.

## 3. Qué archivo usar en cada lugar

| Archivo | Dónde vive | Propósito |
| --- | --- | --- |
| `.env.prod` | Solo VM de producción | Variables reales del stack productivo |
| `.env.gcp` | Solo máquina operativa o VM | Variables reales de scripts GCP si siguen usándose |
| `.env.test` | Solo local / testing | Variables no productivas |
| `odoo/.env` | Solo local | Variables del contenedor Odoo local |
| `*.example` | Git | Contrato de configuración sin secretos |

## 4. Plantillas seguras

El repo ahora debe usar estas plantillas:

- `.env.example`
- `.env.gcp.example`
- `.env.prod.example`
- `.env.test.example`
- `odoo/.env.example`

Flujo recomendado:

```bash
cp .env.prod.example .env.prod
cp .env.test.example .env.test
cp odoo/.env.example odoo/.env
```

Luego rellena los valores reales fuera de Git.

## 5. Cómo evitar que Git vuelva a subir secretos

`.gitignore` debe ignorar explícitamente los archivos operativos:

- `.env`
- `.env.gcp`
- `.env.prod`
- `.env.test`
- `odoo/.env`

Si alguno ya estaba en el índice, deja de versionarlo sin borrarlo del disco:

```bash
git rm --cached .env.gcp .env.prod .env.test odoo/.env
```

Si también existiera `.env` en Git:

```bash
git rm --cached .env
```

## 6. Cómo sincronizar local con producción

### Validar que el código local coincide con la VM

Ejemplo con hashes:

```powershell
Get-FileHash docker-compose.production.yml -Algorithm SHA256
gcloud compute ssh galantes-prod-vm --zone us-central1-a --command `
  "cd ~/galantesjewelry && sha256sum docker-compose.production.yml"
```

Haz lo mismo con los archivos críticos antes de desplegar cambios:

- `Dockerfile`
- `docker-compose.production.yml`
- `lib/google-calendar.ts`
- `lib/appointment-flow.ts`
- `src/config/odooClient.js`
- `lib/odoo-cms-sync.ts`
- `components/ContactForm.tsx`
- `app/contact/page.tsx`

### Subir cambios a la VM

Si trabajas directo contra la VM:

```bash
rsync -avz --delete ./ ubuntu@<vm-host>:/home/ubuntu/galantesjewelry/
```

Luego en la VM:

```bash
cd /home/ubuntu/galantesjewelry
docker compose --env-file .env.prod -f docker-compose.production.yml build
docker compose --env-file .env.prod -f docker-compose.production.yml up -d
```

### Verificar despliegue

```bash
docker compose --env-file .env.prod -f docker-compose.production.yml ps
curl -L https://galantesjewelry.com/api/health
```

## 7. Dónde deben vivir los secretos reales

- `.env.prod` en la VM
- Google OAuth y Service Account en variables de entorno del servidor
- secretos administrables desde panel admin solo si el backend los cifra en reposo
- GitHub Actions secrets solo cuando un workflow los necesite

No dupliques un mismo secreto en repo, GitHub, CI y servidor salvo que exista una razón operativa clara.

## 8. Rotación obligatoria si ya estuvieron en GitHub

Si un secreto estuvo en un archivo versionado, trátalo como comprometido. Rota al menos:

- `CF_TUNNEL_TOKEN_PROD`
- `CF_API_TOKEN`
- `ADMIN_PASSWORD`
- `ADMIN_SECRET_KEY`
- `INTEGRATIONS_SECRET_KEY`
- `GOOGLE_SESSION_SECRET`
- `ODOO_PASSWORD`
- `ODOO_API_KEY`
- `POSTGRES_PASSWORD`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REFRESH_TOKEN`
- `GOOGLE_PRIVATE_KEY`
- `GMAIL_SMTP_PASS`
- `SENDGRID_API_KEY`
- `META_SYNC_TOKEN`

## 9. Cómo limpiar historial si hace falta sacar secretos de GitHub

Quitar archivos del índice evita futuros commits inseguros, pero no limpia el historial antiguo. Si necesitas borrarlos del historial remoto:

```bash
pip install git-filter-repo
git filter-repo --path .env.gcp --path .env.prod --path .env.test --path odoo/.env --invert-paths
git push --force --all
git push --force --tags
```

Haz esto solo coordinando con quien consuma el repositorio, porque reescribe la historia.

## 10. Validación final recomendada

Antes de cerrar un cambio:

1. `git status` no debe mostrar `.env` reales como archivos versionados.
2. `rg` no debe encontrar passwords o keys reales fuera de archivos locales ignorados.
3. La VM debe seguir levantando el stack con `.env.prod`.
4. Debe pasar una prueba funcional contra producción o staging según el cambio.

## 11. Estado actual

Al cierre de esta guía:

- el código crítico de citas ya coincide con producción
- se agregaron plantillas seguras faltantes
- se eliminaron hardcodes obvios del árbol versionado
- queda pendiente rotar credenciales que alguna vez estuvieron en Git
