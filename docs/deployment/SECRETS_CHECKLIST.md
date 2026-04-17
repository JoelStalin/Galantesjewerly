# Checklist de secretos para `.env.gcp`

Este documento explica **cómo obtener** cada uno de los valores que debes pegar en `.env.gcp` antes de ejecutar `./scripts/gcp/deploy.sh`. Mantén este archivo como referencia; **no** lo rellenes con valores reales — esos van solo en `.env.gcp` (que está en `.gitignore`).

---

## 1. Google Cloud Platform

Ya preconfigurado en `.env.gcp.example`:

| Variable | Valor | Cómo obtener |
|---|---|---|
| `GCP_PROJECT_ID` | `deft-haven-493016-m4` | GCP Console → selector de proyectos |
| `GCP_VM_NAME` | `galantes-prod-vm` | Ya creada |
| `GCP_ZONE` | `us-central1-a` | Donde vive la VM |
| `GCP_VM_EXTERNAL_IP` | `136.114.48.210` | `gcloud compute addresses list` |
| `GCP_VM_REPO_DIR` | `/home/<tu-usuario>/galantesjewelry` | Auto-generado por `02-push-to-vm.sh` |

Autenticación local (no va en `.env`):
```bash
gcloud auth login
gcloud auth application-default login   # solo si usas APIs no-CLI
gcloud config set project deft-haven-493016-m4
```

---

## 2. Dominios y DNS (Cloudflare)

| Variable | Cómo obtener |
|---|---|
| `CF_API_TOKEN` | https://dash.cloudflare.com/profile/api-tokens → **Create Token** → template **Custom** con scopes `Zone:Read` + `Zone:DNS:Edit` limitados a la zona `galantesjewelry.com`. Copia el token (se muestra una sola vez). |
| `CF_ZONE_NAME` | `galantesjewelry.com` (el apex) |
| `CF_ZONE_ID` | Opcional. Si lo dejas vacío, `05-cutover-dns.sh` lo resuelve por API. Manualmente: Cloudflare dashboard → selecciona zona → sidebar derecho → **Zone ID**. |
| `GCP_HOSTNAMES` | `galantesjewelry.com www.galantesjewelry.com shop.galantesjewelry.com odoo.galantesjewelry.com` (separados por espacio) |

**Nota Squarespace**: El dominio está registrado en Squarespace, pero los nameservers ya apuntan a Cloudflare. **No toques Squarespace** salvo que cambies de registrar. Todo el manejo de DNS se hace en Cloudflare.

---

## 3. TLS / Let's Encrypt

| Variable | Cómo obtener |
|---|---|
| `LETSENCRYPT_EMAIL` | Tu email real (ej. `joelstalin2105@gmail.com`). Let's Encrypt te avisará por email cuando certs estén por expirar. |
| `LETSENCRYPT_STAGING` | `0` para producción. Usa `1` si estás probando y no quieres gastar tu rate limit de LE (5 certs por dominio por semana). |

---

## 4. Postgres / Odoo

| Variable | Cómo generar |
|---|---|
| `POSTGRES_USER` | `odoo` (default) |
| `POSTGRES_PASSWORD` | `openssl rand -base64 32` — anótala, la necesitas si quieres conectar a la DB desde fuera |
| `POSTGRES_DB` | `postgres` (Odoo crea su propia DB arriba) |
| `ODOO_DB` | `galantes_prod` (o el nombre que prefieras) |
| `ODOO_PASSWORD` | Password de admin del portal Odoo (`admin` / este password). `openssl rand -base64 24` |
| `ODOO_MASTER_PASSWORD` | Password que protege el database manager de Odoo (el de `/web/database/manager`). Usa otro random, **diferente** al de admin. |
| `ODOO_API_KEY` | Se genera **después** del primer boot: login en Odoo como admin → Settings → Users → Developer API Keys → **New**. Copia el token y pégalo aquí. Se usa para que Next.js llame a `/api/v1/...` de Odoo con bearer auth. |

---

## 5. Next.js (web / panel admin)

| Variable | Cómo obtener |
|---|---|
| `ADMIN_PASSWORD` | Password del panel admin en Next.js. `openssl rand -base64 24` |
| `ADMIN_SECRET_KEY` | Firma JWT de sesión admin. `openssl rand -base64 48` |
| `META_SYNC_TOKEN` | Token que protege `/api/v1/meta/sync`. `openssl rand -base64 32` |
| `NEXT_PUBLIC_SITE_URL` | `https://galantesjewelry.com` |
| `NODE_ENV` | `production` |

---

## 6. Google OAuth (Calendar para citas)

En https://console.cloud.google.com/apis/credentials (mismo proyecto `deft-haven-493016-m4`):

1. **APIs & Services → Library** → busca **Google Calendar API** → Enable
2. **Credentials** → **Create Credentials** → **OAuth client ID**
   - Tipo: Web application
   - Authorized redirect URIs: `https://galantesjewelry.com/api/auth/google/callback`
3. Copia Client ID y Secret

| Variable | Valor |
|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` | `xxxxx.apps.googleusercontent.com` |
| `GOOGLE_OAUTH_CLIENT_SECRET` | `GOCSPX-xxxxx` |
| `GOOGLE_OAUTH_REDIRECT_URI` | `https://galantesjewelry.com/api/auth/google/callback` |

Para el **Service Account** (si usas server-to-server en lugar de OAuth de usuario):
- **IAM & Admin → Service Accounts** → Create → role mínimo `Calendar API User`
- **Keys** → Add key → JSON → descarga el archivo
- Pega el contenido JSON en una sola línea (escape de comillas) en `GOOGLE_SERVICE_ACCOUNT_JSON`, o súbelo a la VM y pon el path en `GOOGLE_SERVICE_ACCOUNT_PATH`.

---

## 7. SendGrid (emails transaccionales)

https://app.sendgrid.com → Settings → API Keys → Create API Key → Full Access (o solo Mail Send).

| Variable | Valor |
|---|---|
| `SENDGRID_API_KEY` | `SG.xxxxx` (se muestra una vez) |
| `SENDGRID_FROM_EMAIL` | Ej. `noreply@galantesjewelry.com` (verifica el dominio en SendGrid → Sender Authentication) |
| `SENDGRID_FROM_NAME` | `Galante's Jewelry` |

---

## 8. Gmail App Password (opcional — fallback SMTP)

Si además quieres enviar por SMTP desde una cuenta Gmail:
1. Activa 2FA en la cuenta: https://myaccount.google.com/security
2. Ve a https://myaccount.google.com/apppasswords
3. Genera un app password de 16 caracteres

| Variable | Valor |
|---|---|
| `GMAIL_USER` | `noreply@galantesjewelry.com` (o la que uses) |
| `GMAIL_APP_PASSWORD` | 16 caracteres sin espacios |

---

## 9. Meta (Facebook / Instagram / WhatsApp Business)

https://developers.facebook.com/apps → selecciona tu app.

| Variable | Cómo obtener |
|---|---|
| `META_APP_ID` | Dashboard de la app → Settings → Basic |
| `META_APP_SECRET` | Mismo lugar, click en **Show** |
| `META_PAGE_ACCESS_TOKEN` | Graph API Explorer → selecciona la página → genera token long-lived con scopes `pages_manage_posts`, `pages_read_engagement` |
| `META_CATALOG_ID` | Commerce Manager → Catalog → Settings |
| `META_VERIFY_TOKEN` | Cualquier string random que tú inventes — debe coincidir con el valor que pones en el webhook de Meta |

---

## 10. EasyPost (shipping)

https://www.easypost.com/account/api-keys

| Variable | Valor |
|---|---|
| `EASYPOST_API_KEY` | Production key (`EZAK...`) |
| `EASYPOST_TEST_KEY` | Test key para dev (`EZTK...`) |

Nota: EasyPost se configura también dentro de Odoo (Settings → Inventory → Shipping Methods → EasyPost), no solo en `.env`.

---

## 11. Stripe / pagos (si aplica)

https://dashboard.stripe.com/apikeys

| Variable | Valor |
|---|---|
| `STRIPE_PUBLISHABLE_KEY` | `pk_live_...` |
| `STRIPE_SECRET_KEY` | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Dashboard → Developers → Webhooks → crea endpoint `https://galantesjewelry.com/api/webhooks/stripe` → copia el signing secret (`whsec_...`) |

---

## 12. Migración desde Termux (solo si usas `--mode ssh`)

Si decides migrar la data vieja desde Android/Termux vía SSH:

| Variable | Cómo obtener |
|---|---|
| `TERMUX_SSH_HOST` | `ssh.galantesjewelry.com` (CNAME al tunnel Cloudflare) o la IP pública si Termux está directamente expuesto |
| `TERMUX_SSH_USER` | Normalmente `u0_a<número>` — corre `whoami` dentro de Termux |
| `TERMUX_SSH_PORT` | `8022` (default de Termux `sshd`) |
| `TERMUX_ODOO_DB_DUMP_PATH` | Path opcional si ya tienes un dump previo, ej. `/data/data/com.termux/files/home/galantes_prod.sql` |
| `TERMUX_DATA_BLOBS_PATH` | `/data/data/com.termux/files/home/galantesjewelry/data` |

Si el SSH sigue dando timeout (como en el handoff), usa `--mode local` con un backup hecho manualmente, o `--mode fresh` para empezar limpio.

---

## 13. Checklist final antes del primer `deploy.sh`

Obligatorios (el script se detiene si faltan):

- [ ] `ADMIN_PASSWORD`
- [ ] `ADMIN_SECRET_KEY`
- [ ] `POSTGRES_PASSWORD`
- [ ] `ODOO_PASSWORD`
- [ ] `META_SYNC_TOKEN`
- [ ] `LETSENCRYPT_EMAIL`
- [ ] `CF_API_TOKEN`
- [ ] `GCP_VM_EXTERNAL_IP` (ya viene preseteado)
- [ ] `GCP_HOSTNAMES` (ya viene preseteado)

Recomendados (features se degradan si faltan, pero deploy sigue):

- [ ] `SENDGRID_API_KEY` — sin esto, no hay confirmaciones de citas
- [ ] `GOOGLE_OAUTH_CLIENT_ID` / `SECRET` — sin esto, no hay sync a Calendar
- [ ] `ODOO_API_KEY` — se genera **después** del primer boot, déjalo vacío la primera vez
- [ ] `META_*` — solo si ya vas a sincronizar catálogo
- [ ] `STRIPE_*` — solo si procesas pagos online fuera de Odoo
- [ ] `EASYPOST_API_KEY` — solo si envías paquetes

---

## 14. Generador rápido de secretos random

Ejecuta esto en tu terminal y copia los valores al `.env.gcp`:

```bash
echo "ADMIN_PASSWORD=$(openssl rand -base64 24)"
echo "ADMIN_SECRET_KEY=$(openssl rand -base64 48)"
echo "POSTGRES_PASSWORD=$(openssl rand -base64 32)"
echo "ODOO_PASSWORD=$(openssl rand -base64 24)"
echo "ODOO_MASTER_PASSWORD=$(openssl rand -base64 32)"
echo "META_SYNC_TOKEN=$(openssl rand -base64 32)"
```

---

## 15. Seguridad

- **Nunca** commitees `.env.gcp`. Verifica que esté en `.gitignore`.
- Permisos en la VM: `02-push-to-vm.sh` hace `chmod 600 .env.gcp` después de subirlo.
- Rota `CF_API_TOKEN` si sospechas compromiso (`dash.cloudflare.com/profile/api-tokens → Roll`).
- Rota `ODOO_MASTER_PASSWORD` vía `/web/database/manager` → **Set Master Password**.
- Para secretos de larga vida (Google OAuth, SendGrid, Meta), considera moverlos a **Secret Manager** de GCP en una iteración futura (`gcloud secrets create ...`). El patrón actual con `.env.gcp` es el mínimo viable.

---

**Última actualización**: 2026-04-17
