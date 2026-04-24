# Galantes Jewelry — Backlog

> Última actualización: 2026-04-24
> Estado productivo: GCP `galantes-prod-vm` (136.114.48.210) — LIVE
> Staging objetivo: Getupsoft (`ssh.getupsoft.com.do`)

---

## CRÍTICO — Staging Setup (bloqueante para todo lo demás)

| # | Tarea | Estado | Notas |
|---|-------|--------|-------|
| S-1 | Crear rama `develop` en GitHub | PENDIENTE | Base del workflow de staging |
| S-2 | Configurar secrets GitHub environment `Staging` | PENDIENTE | Ver tabla de secrets abajo |
| S-3 | Crear Cloudflare Tunnel para staging | PENDIENTE | Obtener `CF_TUNNEL_TOKEN_STAGING` |
| S-4 | Primer deploy manual en getupsoft | PENDIENTE | `ssh getupsoft` + clone + `.env.staging` manual |
| S-5 | Verificar health checks staging | PENDIENTE | `http://127.0.0.1:3001/api/health` y `8082/healthz` |
| S-6 | Configurar dominio staging (ej. `staging.galantesjewelry.com`) | PENDIENTE | Via Cloudflare DNS |

### Secrets requeridos en GitHub → Staging environment

| Secret | Valor |
|--------|-------|
| `STAGING_SSH_HOST` | `ssh.getupsoft.com.do` |
| `STAGING_SSH_USER` | `ubuntu` |
| `STAGING_SSH_KEY` | Contenido de `~/.ssh/getupsoft` |
| `STAGING_SSH_PORT` | `22` |
| `CF_TUNNEL_TOKEN_STAGING` | Token del nuevo tunnel Cloudflare staging |
| `STRIPE_SECRET_KEY_STAGING` | Stripe test key (`sk_test_...`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_STAGING` | Stripe test publishable key |
| `GOOGLE_OAUTH_REDIRECT_URI_STAGING` | `https://staging.galantesjewelry.com/auth/google/callback` |
| + todos los secrets de Production | Heredados o duplicados |

---

## ALTA PRIORIDAD — Producción / Protección de datos

| # | Tarea | Estado | Notas |
|---|-------|--------|-------|
| P-1 | Verificar que `scripts/backup/predeploy-backup.sh` existe en GCP VM | PENDIENTE | Deploy.yml lo llama — si no existe usa fallback inline |
| P-2 | Verificar que `scripts/backup/predeploy-restore.sh` existe en GCP VM | PENDIENTE | Rollback automático depende de esto |
| P-3 | Confirmar volúmenes `odoo-data` y `postgres-data` son named (no bind-mounts) | VERIFICADO ✅ | `docker-compose.production.yml` usa named volumes |
| P-4 | Nunca ejecutar `docker compose down -v` en producción | REGLA ACTIVA ✅ | Deploy.yml usa `up -d --no-deps` |
| P-5 | Imágenes de productos Odoo → Next.js shop | EN PROGRESO | `imageUrl: null` en catalog API — serialización pendiente |

---

## ALTA PRIORIDAD — Funcionalidades pendientes

| # | Tarea | Estado | Notas |
|---|-------|--------|-------|
| F-1 | Imágenes de productos: `product_api.py` → incluir `image_1920` en respuesta | EN PROGRESO | `odoo/addons/galantes_jewelry/controllers/product_api.py` |
| F-2 | Odoo sync de appointments via JSON-2 API | PENDIENTE | Verificar `galante.appointment/create_from_api` con credenciales reales |
| F-3 | Retry/alert para Odoo sync fallidos | PENDIENTE | Si sync falla, appointment debe crearse igual (Google Calendar ya funciona) |
| F-4 | Admin: filtrado/reporting por `odooSyncStatus` | PENDIENTE | Panel admin |
| F-5 | Archivos no rastreados en git: `app/api/checkout/status/`, `app/api/shipping/`, `app/auth/verify-email/`, `app/checkout/success/`, `components/ContactFormShell.tsx`, `components/SafeEmailLink.tsx` | PENDIENTE | Commitear o limpiar |

---

## MEDIA PRIORIDAD — Mejoras operativas

| # | Tarea | Estado | Notas |
|---|-------|--------|-------|
| O-1 | Rotation automática de backups (>30 días purge) | PENDIENTE | Evitar llenar disco en GCP |
| O-2 | Monitoreo/alertas de salud de producción | PENDIENTE | Uptime check externo (BetterUptime, UptimeRobot) |
| O-3 | Google OAuth reconnect flow (owner manual) | PENDIENTE MANUAL | Token expira — owner debe reautenticar vía browser |
| O-4 | Observabilidad Odoo sync en admin panel | PENDIENTE | Ver detalles de sync en vistas admin |
| O-5 | Tests E2E para staging | PENDIENTE | Correr tests contra staging antes de promover a prod |

---

## BAJA PRIORIDAD — Técnico / Deuda

| # | Tarea | Estado | Notas |
|---|-------|--------|-------|
| T-1 | Limpiar docker-compose legacy (`-v2`, `-v3`, `-v4-fix`, `-v5-final`) | PENDIENTE | Solo conservar `production.yml` y `staging.yml` |
| T-2 | Commitear tests actualizados (`tests/unit/`) | PENDIENTE | Están modificados localmente — no están en git |
| T-3 | Configurar `.gitattributes` para LF consistente | PENDIENTE | Evitar ruido CRLF en diffs de Windows |
| T-4 | Regression test para Odoo 401/404 en appointments | PENDIENTE | Necesita credenciales reales |
| T-5 | Documentación: actualizar ODOO_SETUP.md con flujo de billing | PENDIENTE | |

---

## COMPLETADO ✅ (referencia)

- Checkout Stripe → Odoo billing automático (orden + factura + delivery)
- Portal cliente: `/account/orders` y `/account/invoices`
- Appointment flow end-to-end (Google Calendar + email)
- Admin panel: schedule controls, brand_name, sticky navbar
- Production rollback automático en deploy
- Named volumes en producción (datos persistentes)
- Cloudflare tunnel producción (resiliente)

---

## Flujo de trabajo Git (regla)

```
feature/fix → develop → [auto-deploy staging] → validar → main → [manual-deploy producción]
```

**Nunca pushear directo a `main` sin pasar por staging.**
