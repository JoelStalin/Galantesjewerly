# Fix definitivo — Sincronización de Google Calendar en el panel de integración

**Fecha:** 2026-04-20
**Proyecto GCP:** `deft-haven-493016-m4`
**Cuenta:** `ceo@galantesjewelry.com`

---

## Diagnóstico — por qué no sincroniza hoy

Encontré estos bugs en tu configuración (los tres bloquean el sync por separado):

| # | Problema | Archivo | Impacto |
|---|----------|---------|---------|
| 1 | Variables en minúsculas (`client_id`, `client_secret`) | `.env` | `process.env.CLIENT_ID` devolvía `undefined` → el código lanzaba "Google OAuth configuration is missing" |
| 2 | Valores literales `GOOGLE_CLIENT_ID` / `GOOGLE_SECRET` | `.env` | Nunca se pegaron las credenciales reales |
| 3 | Faltaban `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_CALENDAR_ID`, `GOOGLE_OAUTH_SCOPES` | `.env` | Código hacía fallback vacío → 401 `invalid_grant` |
| 4 | `token.json` no existe | raíz del proyecto | El flujo Express (`services/calendarService.js`) no tiene credenciales almacenadas |
| 5 | `GOOGLE_OAUTH_SCOPES=openid email profile` (en `.env.example`) | config | Faltaba `auth/calendar` → token sin permiso para leer/escribir calendar |
| 6 | `REDIRECT_URI` apuntaba a `/auth/google/callback` pero el panel admin usa `/api/admin/google/oauth/callback` | config | Si Cloud Console no registra AMBAS, falla con `redirect_uri_mismatch` |

---

## Lo que ya corregí en código

1. **`.env`** reescrito con los nombres correctos en mayúsculas y estructura completa. Los secretos reales (`CF_TUNNEL_TOKEN`, `GOOGLE_API_KEY`) se preservaron. Todo lo que dice `REPLACE_ME_...` hay que rellenarlo (pasos abajo).
2. Scopes ampliados a `openid email profile calendar gmail.send`.
3. Variables duplicadas (`CLIENT_ID` vs `GOOGLE_OAUTH_CLIENT_ID`) ahora comparten el mismo valor — el código acepta cualquiera de los dos, así no importa qué ruta se ejecute primero.

---

## Lo que tienes que hacer tú en Google Cloud Console

**Estos pasos tienen que los hacer TÚ desde tu navegador logueado como `ceo@galantesjewelry.com`.** Yo no puedo hacerlos: Google Cloud Console bloquea agentes automatizados y además se requiere tu consentimiento explícito al scope.

### Paso 1 — Habilitar Google Calendar API

1. Ve a <https://console.cloud.google.com/apis/library/calendar-json.googleapis.com?project=deft-haven-493016-m4>
2. Click **Enable** (si ya está habilitada dice "Manage" — perfecto, pasa al siguiente paso).
3. Mientras estás ahí, habilita también **Gmail API**: <https://console.cloud.google.com/apis/library/gmail.googleapis.com?project=deft-haven-493016-m4>

### Paso 2 — Crear/verificar el OAuth 2.0 Client ID

1. Ve a <https://console.cloud.google.com/apis/credentials?project=deft-haven-493016-m4>
2. Si ya hay un **OAuth 2.0 Client ID** de tipo "Web application", click en su nombre para editarlo. Si no, click **+ CREATE CREDENTIALS → OAuth client ID → Web application**.
3. **Name:** `Galantes Jewelry Web`
4. **Authorized JavaScript origins** — agregar los dos:
   - `http://localhost:3000`
   - `https://galantesjewelry.com`
5. **Authorized redirect URIs** — agregar los cuatro (¡exactos, sin slash al final!):
   - `http://localhost:3000/auth/google/callback`
   - `http://localhost:3000/api/admin/google/oauth/callback`
   - `https://galantesjewelry.com/auth/google/callback`
   - `https://galantesjewelry.com/api/admin/google/oauth/callback`
6. **SAVE**. Google te muestra un panel con **Client ID** y **Client secret**.

### Paso 3 — Configurar OAuth consent screen (si no está)

1. <https://console.cloud.google.com/apis/credentials/consent?project=deft-haven-493016-m4>
2. User type: **Internal** (si usas Workspace `galantesjewelry.com`) — esto evita el proceso de verificación de Google.
3. App name: `Galantes Jewelry`
4. User support email: `ceo@galantesjewelry.com`
5. En **Scopes**, añade manualmente:
   - `openid`
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `https://www.googleapis.com/auth/calendar`
   - `https://www.googleapis.com/auth/gmail.send`
6. **SAVE AND CONTINUE** hasta publicar.

### Paso 4 — Pegar las credenciales en `.env`

Abre `C:\Users\yoeli\Documents\Galantesjewelry\.env` y reemplaza estas **seis** líneas (los valores `REPLACE_ME_...`):

```env
GOOGLE_OAUTH_CLIENT_ID=<PEGA AQUÍ el Client ID del paso 2>
GOOGLE_OAUTH_CLIENT_SECRET=<PEGA AQUÍ el Client secret del paso 2>
CLIENT_ID=<MISMO Client ID>
CLIENT_SECRET=<MISMO Client secret>
```

Guarda el archivo.

### Paso 5 — Verificar que la config esté bien (sin arrancar el server todavía)

Abre una terminal en el proyecto y corre:

```bash
node scripts/diagnose-google-calendar.js
```

Te dirá exactamente qué falta (si algo falta). Si ves `✅ All required config present` puedes seguir.

### Paso 6 — Conectar la cuenta desde el panel admin

1. Arranca el server Next.js: `npm run dev`
2. Ve a <http://localhost:3000/admin/login> y entra como admin.
3. Pestaña **Integrations** → **Google** → click **Connect owner account**.
4. Google te va a redirigir a tu login de `ceo@galantesjewelry.com` → pedirá permisos (Calendar + Gmail send) → click **Allow**.
5. Te regresa al panel con `google_owner_oauth=connected` en la URL → ✅ significa que el `refresh_token` quedó guardado en la DB encriptada.
6. En la subsección **Appointments**, activa **Google Calendar enabled** y pon `GOOGLE_CALENDAR_ID=primary` (o el ID de un calendar compartido si quieres separar appointments).
7. Click **Test connection** → si dice `ok: true, calendar: { calendarId: 'primary', ... }` quedó sincronizado.

### Paso 7 — Verificar end-to-end

Envía un appointment de prueba desde el form público. Debería aparecer:
- ✅ Un evento nuevo en `calendar.google.com` de `ceo@galantesjewelry.com`
- ✅ Un correo a `ceo@galantesjewelry.com` vía SendGrid/Gmail
- ✅ Un partner+activity en Odoo

Si falla, revisa los logs de Next.js — el mensaje ahora es específico (`Google Calendar is not configured`, `Google OAuth authorization expired`, etc.) gracias al código ya existente en `lib/google-calendar.ts:103`.

---

## Si algo sale mal — errores comunes y fix

| Error | Causa | Fix |
|-------|-------|-----|
| `redirect_uri_mismatch` | Olvidaste uno de los 4 redirect URIs del paso 2.5 | Vuelve al paso 2 y agrégalos TODOS |
| `invalid_grant` después de conectar | El `refresh_token` se revocó o se guardó mal | Ve a <https://myaccount.google.com/permissions>, revoca "Galantes Jewelry", reconecta desde el paso 6 |
| `insufficient_scope` | No aceptaste el scope de Calendar en el consent screen | Revoca el acceso (link de arriba) y reconecta — asegúrate de marcar el checkbox de Calendar |
| `Google OAuth is not configured` | `.env` no tiene `GOOGLE_OAUTH_CLIENT_ID` | Re-revisa el paso 4 |
| `Google Calendar integration is disabled` | El toggle `googleCalendarEnabled` en la DB está `false` | Activa "Google Calendar enabled" en el panel admin (paso 6.6) |

---

## Cambio de contraseña (urgente)

Compartiste la contraseña de `ceo@galantesjewelry.com` en el chat. **Cámbiala ya** en <https://myaccount.google.com/security> → "Password". Luego activa 2FA si no lo tienes — es obligatorio para Workspace.
