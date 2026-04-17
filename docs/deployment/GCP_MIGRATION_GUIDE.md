# Guía de Migración a Google Cloud Platform

**Proyecto**: Galante's Jewelry
**Destino**: VM `galantes-prod-vm` en proyecto `deft-haven-493016-m4` (us-central1-a)
**IP pública**: `136.114.48.210`
**Modelo**: Docker Compose sobre una sola VM e2-medium (~$27/mes)
**TLS**: Let's Encrypt + Certbot (auto-renovación)
**DNS**: Cloudflare (registrar Squarespace, nameservers Cloudflare)

---

## 1. Visión general

Este repositorio ahora incluye un pipeline completo de migración bajo `scripts/gcp/`. La filosofía: **un script por fase, todos idempotentes, todos lanzables desde tu máquina local con `gcloud` autenticado**.

Diagrama lógico final:

```
  Internet
     │
     ▼
  Cloudflare DNS (proxied=false durante cert issuance)
     │
     ▼   136.114.48.210:443
  ┌──────────────────────────────────────────────────┐
  │  GCP VM (galantes-prod-vm, Ubuntu 22.04)         │
  │  ┌────────────────────────────────────────────┐  │
  │  │ nginx (TLS termination, Let's Encrypt)     │  │
  │  │  ├─ galantesjewelry.com      → web:3000    │  │
  │  │  ├─ www.galantesjewelry.com  → web:3000    │  │
  │  │  ├─ shop.galantesjewelry.com → odoo:8069   │  │
  │  │  └─ odoo.galantesjewelry.com → odoo:8069   │  │
  │  └────────────────────────────────────────────┘  │
  │  ┌──────────────┐  ┌─────────────┐  ┌─────────┐  │
  │  │ web (Next.js)│  │ odoo (19)   │  │postgres │  │
  │  └──────────────┘  └─────────────┘  └─────────┘  │
  │  ┌────────────────────────────────────────────┐  │
  │  │ certbot (loop, renova cada 12h)            │  │
  │  └────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────┘
```

---

## 2. Prerrequisitos

Desde tu máquina local (Windows/Mac/Linux):

1. **Google Cloud SDK** instalado y autenticado:
   ```bash
   gcloud auth login
   gcloud config set project deft-haven-493016-m4
   ```

2. **Acceso SSH a la VM** (gcloud lo gestiona):
   ```bash
   gcloud compute ssh galantes-prod-vm --zone us-central1-a --command="echo ok"
   ```
   Si esto falla, revisa permisos IAM (`roles/compute.osAdminLogin`).

3. **Permisos en Cloudflare** — API token con scopes:
   - `Zone:Read`
   - `Zone:DNS:Edit`
   Lo creas en: https://dash.cloudflare.com/profile/api-tokens

4. **Secretos reales**: lee `docs/deployment/SECRETS_CHECKLIST.md` para la lista completa.

---

## 3. Ruta rápida (happy path — 20 min)

```bash
# 1. Copiar template y rellenar secretos
cp .env.gcp.example .env.gcp
nano .env.gcp          # o tu editor preferido
# Mínimo obligatorio: ADMIN_PASSWORD, POSTGRES_PASSWORD, ODOO_PASSWORD,
# META_SYNC_TOKEN, CF_API_TOKEN, LETSENCRYPT_EMAIL

# 2. Ejecutar deploy completo (fresh, sin datos viejos de Termux)
chmod +x scripts/gcp/*.sh scripts/gcp/lib/*.sh
./scripts/gcp/deploy.sh --fresh
```

Al finalizar verás las URLs activas. Todo el flujo (gcloud → rsync → DNS → certbot → stack → validate) corre automáticamente.

---

## 4. Ruta paso a paso (si algo falla)

Cada script imprime qué hizo y qué sigue. Se pueden correr individualmente:

| Paso | Script | Qué hace | Requiere |
|------|--------|----------|----------|
| 1 | `01-bootstrap-vm.sh` | Valida/crea VM, firewall, IP estática, Docker | gcloud auth |
| 2 | `02-push-to-vm.sh` | Sincroniza repo + `.env.gcp` a la VM | paso 1 |
| 3 | `05-cutover-dns.sh` | Actualiza A records en Cloudflare → IP GCP | CF_API_TOKEN válido |
| 4 | `04-start-stack.sh` | Arranca nginx/web/odoo/db (HTTP-only bootstrap) | paso 2 |
| 5 | `03-issue-certs.sh` | Emite certs Let's Encrypt via HTTP-01 | paso 3 + paso 4 |
| 6 | `04-start-stack.sh` (2ª vez) | Recarga nginx con conf.d-gcp (HTTPS) | paso 5 |
| 7 | `06-migrate-data-from-termux.sh` | Opcional: migra datos desde Android | SSH a Termux o backup local |
| 8 | `07-validate.sh` | Smoke tests E2E | todos |

Para correr solo un paso:
```bash
./scripts/gcp/deploy.sh --step 3
```

---

## 5. Migración de datos desde Termux

El handoff previo indicó que SSH a Termux fallaba por timeout. El script `06-migrate-data-from-termux.sh` soporta tres modos:

### Modo A — SSH directo (si lo reparas)
Rellena en `.env.gcp`:
```
TERMUX_SSH_HOST=ssh.galantesjewelry.com
TERMUX_SSH_USER=u0_a123
TERMUX_SSH_PORT=8022
```
Luego:
```bash
./scripts/gcp/06-migrate-data-from-termux.sh --mode ssh
```

### Modo B — Backup local
Si puedes hacer `pg_dump` y `tar` manualmente en Termux y copiar los archivos a tu PC:
```bash
# Desde Termux:
docker exec galantes_db pg_dump -U odoo galantes_prod > ~/galantes_prod.sql
tar -czf ~/blobs.tgz -C ~/galantesjewelry data

# Copia a tu PC (via Syncthing, Google Drive, etc.)

# Luego desde tu PC:
./scripts/gcp/06-migrate-data-from-termux.sh --mode local \
    --sql-dump ./galantes_prod.sql \
    --data-tar ./blobs.tgz
```

### Modo C — Fresh (DB vacía)
```bash
./scripts/gcp/06-migrate-data-from-termux.sh --mode fresh
```
Odoo se inicializa con los módulos de `odoo/initial_modules.txt`. El CMS arranca vacío y tú recreas productos en el panel.

---

## 6. DNS: notas específicas de Cloudflare + Squarespace

- El dominio `galantesjewelry.com` está **registrado** en Squarespace, pero los **nameservers** apuntan a Cloudflare. Esto significa que los records se editan en Cloudflare, no en Squarespace.
- `05-cutover-dns.sh` usa la Cloudflare API v4 y actualiza:
  - `galantesjewelry.com` → A → `136.114.48.210` (proxied=false)
  - `www.galantesjewelry.com` → A → `136.114.48.210` (proxied=false)
  - `shop.galantesjewelry.com` → A → `136.114.48.210` (proxied=false)
  - `odoo.galantesjewelry.com` → A → `136.114.48.210` (proxied=false)
- **Por qué proxied=false**: Let's Encrypt HTTP-01 challenge requiere que el servidor responda directamente. Si el tráfico pasa por el proxy de Cloudflare, el challenge falla.
- **Después de que los certs estén emitidos**, puedes activar el proxy (orange cloud) manualmente en Cloudflare si quieres CDN y WAF. No es obligatorio.

---

## 7. Renovación automática de certs

El servicio `certbot` en `docker-compose.gcp.yml` corre un loop: cada 12h ejecuta `certbot renew --webroot`. Si un cert está a ≤30 días de expirar, se renueva automáticamente y crea `/etc/letsencrypt/.renewed`. Para que nginx tome el nuevo cert sin downtime:

```bash
# En la VM:
docker exec galantes_nginx nginx -s reload
```

Puedes automatizar el reload añadiendo un cron en la VM:
```bash
echo '0 * * * * docker exec galantes_nginx nginx -s reload' | crontab -
```

---

## 8. Observabilidad básica

- Logs en vivo:
  ```bash
  gcloud compute ssh galantes-prod-vm --zone us-central1-a --command \
    "cd ~/galantesjewelry && docker compose --env-file .env.gcp -f docker-compose.gcp.yml logs -f --tail=100"
  ```

- Estado:
  ```bash
  gcloud compute ssh galantes-prod-vm --zone us-central1-a --command \
    "cd ~/galantesjewelry && docker compose --env-file .env.gcp -f docker-compose.gcp.yml ps"
  ```

- GCP Console:
  - Compute → VM instances → `galantes-prod-vm` → SSH / Logs / Monitoring
  - Billing → Budgets → `galantes-monthly-budget` ($30 con alertas a 50/90/100%)

---

## 9. Troubleshooting

### "ERROR: Enterprise addons mount not found"
Esto es lo que rompió el intento previo con `docker-compose.production.yml`. `docker-compose.gcp.yml` **no** monta `../cell_odoo/addons/enterprise` — usa solo los addons community de `odoo/initial_modules.txt` y el módulo custom `galantes_jewelry`. Si necesitas addons enterprise, sube un tarball a la VM y modifica el compose agregando otro volumen.

### Let's Encrypt: "Timeout during connect"
El challenge HTTP-01 no pudo alcanzar la VM. Verifica:
```bash
curl -v http://galantesjewelry.com/.well-known/acme-challenge/test
```
Debe dar 404 (no timeout). Si da timeout:
- Firewall: `gcloud compute firewall-rules list | grep galantes-allow-web`
- DNS: `dig +short galantesjewelry.com` debe dar `136.114.48.210`
- Cloudflare proxy: debe estar **OFF** (grey cloud) durante la emisión.

### "Odoo toma mucho en arrancar"
Es normal en el primer boot (5-10 min mientras se instalan los módulos de `initial_modules.txt`). Verifica:
```bash
docker logs -f galantes_odoo
```

### Nginx no recarga después del cert
```bash
docker exec galantes_nginx nginx -t  # Verifica sintaxis
docker exec galantes_nginx nginx -s reload
# Si falla:
docker compose --env-file .env.gcp -f docker-compose.gcp.yml restart nginx
```

---

## 10. Rollback

Si algo va mal y quieres volver al stack en Termux/Cloudflare Tunnel:

1. **DNS**: Revertir A records en Cloudflare a la IP de Termux (o re-habilitar los CNAMEs de tunnel).
2. **Stack GCP**: `gcloud compute instances stop galantes-prod-vm --zone us-central1-a` (mantiene el disco, apaga billing de CPU).
3. **Destruir** (no recomendado hasta validar que la data se migró bien): `gcloud compute instances delete galantes-prod-vm --zone us-central1-a`.

---

## 11. Próximos pasos opcionales

- **Backups**: programar `pg_dump` diario a Cloud Storage (`gsutil cp`).
- **Proxy Cloudflare ON**: activar orange cloud después del cert inicial, con Full (strict) TLS mode.
- **Monitoring**: Cloud Monitoring agent en la VM (`curl -sSO https://dl.google.com/cloudagents/add-monitoring-agent-repo.sh`).
- **Budget alerting**: ya está en $30/mes con alertas 50/90/100%.

---

**Última actualización**: 2026-04-17
**Autor**: Claude (Cowork) — pipeline completo autónomo para cerrar la migración.
