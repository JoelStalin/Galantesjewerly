# Google OAuth 2.0 Setup - Galantes Jewelry

## Resumen

Configuracion recomendada para Google OAuth 2.0 en Galantes Jewelry:

- Tipo de app en Google Cloud: Web application.
- Dominio principal: https://galantesjewelry.com.
- Dominio secundario: https://www.galantesjewelry.com.
- Local: http://localhost:3000.
- Scopes minimos: openid, email, profile.
- Callback canonico para este proyecto Next.js: /api/auth/google/callback.
- Los secretos se administran desde el panel admin en /admin/dashboard, tab "Integrations & OAuth".
- Los secretos, tokens y API keys se guardan cifrados en data/integrations.json.

## Valores exactos para Google Cloud

Authorized JavaScript origins:

| Uso | Valor | Estado |
| --- | --- | --- |
| Produccion apex | https://galantesjewelry.com | Obligatorio |
| Produccion www | https://www.galantesjewelry.com | Obligatorio si www sirve la app o inicia login |
| Desarrollo local | http://localhost:3000 | Obligatorio para pruebas locales |
| Staging recomendado | https://staging.galantesjewelry.com | Opcional si existe staging |

Authorized redirect URIs para este proyecto Next.js:

| Uso | Valor | Estado |
| --- | --- | --- |
| Produccion apex | https://galantesjewelry.com/api/auth/google/callback | Obligatorio |
| Produccion www | https://www.galantesjewelry.com/api/auth/google/callback | Recomendado; obligatorio si el callback puede quedar en www |
| Desarrollo local | http://localhost:3000/api/auth/google/callback | Obligatorio para pruebas locales |
| Staging recomendado | https://staging.galantesjewelry.com/api/auth/google/callback | Opcional si existe staging |

Regla practica: el `redirect_uri` que envia la app a Google debe coincidir exactamente con uno de los valores registrados. Es sensible a esquema, host, puerto y path.

## Callbacks por escenario

| Escenario | Authorized JavaScript origins | Authorized redirect URIs |
| --- | --- | --- |
| Frontend puro con Google Identity Services popup | https://galantesjewelry.com, https://www.galantesjewelry.com, http://localhost:3000 | No usa client secret; si se usa redirect UX: https://galantesjewelry.com/auth/google/callback y http://localhost:3000/auth/google/callback |
| Backend Node/Express | https://galantesjewelry.com, https://www.galantesjewelry.com, http://localhost:3000 | https://galantesjewelry.com/auth/google/callback, https://www.galantesjewelry.com/auth/google/callback, http://localhost:3000/auth/google/callback |
| Next.js custom en este repo | https://galantesjewelry.com, https://www.galantesjewelry.com, http://localhost:3000 | https://galantesjewelry.com/api/auth/google/callback, https://www.galantesjewelry.com/api/auth/google/callback, http://localhost:3000/api/auth/google/callback |
| Next.js con NextAuth/Auth.js | https://galantesjewelry.com, https://www.galantesjewelry.com, http://localhost:3000 | https://galantesjewelry.com/api/auth/callback/google, https://www.galantesjewelry.com/api/auth/callback/google, http://localhost:3000/api/auth/callback/google |
| PHP/Laravel Socialite | https://galantesjewelry.com, https://www.galantesjewelry.com, http://localhost:3000 | https://galantesjewelry.com/auth/google/callback, https://www.galantesjewelry.com/auth/google/callback, http://localhost:3000/auth/google/callback |
| WordPress custom/plugin controlado | https://galantesjewelry.com, https://www.galantesjewelry.com | https://galantesjewelry.com/wp-json/galantes/v1/oauth/google/callback, https://www.galantesjewelry.com/wp-json/galantes/v1/oauth/google/callback |

Para WordPress, si se usa un plugin comercial, copiar exactamente el callback que muestre el plugin. No agregar callbacks de plugins no usados.

## Checklist

1. Crear proyecto en Google Cloud: `galantes-jewelry-production`.
2. Ir a Google Auth Platform y configurar Branding.
3. App name: `Galantes Jewelry`.
4. User support email: `concierge@galantesjewelry.com`.
5. App logo: `https://galantesjewelry.com/assets/branding/logo.png`.
6. Homepage: `https://galantesjewelry.com`.
7. Privacy Policy: `https://galantesjewelry.com/privacy-policy`.
8. Terms of Service: `https://galantesjewelry.com/terms-of-service`.
9. Authorized domains: `galantesjewelry.com`.
10. Developer contact email: `concierge@galantesjewelry.com`.
11. Verificar `galantesjewelry.com` en Google Search Console con el mismo owner/editor del proyecto.
12. Configurar Data Access con scopes minimos: `openid`, `email`, `profile`.
13. Crear OAuth Client ID tipo Web application.
14. Name: `Galantes Jewelry Web Login`.
15. Agregar los Authorized JavaScript origins listados arriba.
16. Agregar los Authorized redirect URIs listados arriba.
17. Descargar/copiar Client ID y Client Secret inmediatamente.
18. Abrir `/admin/dashboard`, tab `Integrations & OAuth`.
19. En production, guardar Client ID, Client Secret, redirect URI, origin y activar Google login.
20. En development, guardar los valores de localhost.
21. Agregar test users si la app queda en modo Testing.
22. Probar `/api/auth/google/start?returnTo=/`.
23. Publicar app cuando homepage, politicas, dominio verificado y scopes esten correctos.
24. Enviar a revision solo si Google lo requiere por pantalla de app no verificada, publicacion externa o scopes sensibles/restringidos.

## Variables de entorno

Variables de bootstrap recomendadas:

```env
SITE_URL=https://galantesjewelry.com
INTEGRATIONS_SECRET_KEY=generate_with_openssl_rand_base64_32
GOOGLE_SESSION_SECRET=generate_with_openssl_rand_base64_32
GOOGLE_OAUTH_CLIENT_ID=replace_after_google_cloud_creation.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=replace_after_google_cloud_creation
GOOGLE_OAUTH_JAVASCRIPT_ORIGIN=https://galantesjewelry.com
GOOGLE_OAUTH_REDIRECT_URI=https://galantesjewelry.com/api/auth/google/callback
GOOGLE_OAUTH_SCOPES=openid email profile
```

Comando para claves locales:

```bash
openssl rand -base64 32
```

En produccion, configurar esos secretos en el entorno del servidor y luego administrar las credenciales Google desde el panel admin.

## Diseno del panel de administracion

Ruta:

- `/admin/dashboard`
- Tab: `Integrations & OAuth`

Capacidades:

- Editar Google Client ID.
- Reemplazar Google Client Secret sin mostrarlo.
- Editar Authorized JavaScript origin.
- Editar Authorized redirect URI por environment.
- Editar scopes.
- Editar API key, access token y refresh token relacionados.
- Activar o desactivar Google login por environment.
- Guardar cambios sin tocar codigo fuente.
- Ver auditoria de cambios.
- Ver secretos enmascarados con formato `********1234`.
- Cifrar secretos en base de datos/archivo.
- Restringir acceso con sesion admin.
- Probar Google discovery desde el backend.

Rutas implementadas:

| Ruta | Metodo | Uso |
| --- | --- | --- |
| `/api/admin/integrations` | GET | Lee configuracion enmascarada y auditoria |
| `/api/admin/integrations` | PUT | Guarda cambios y cifra secretos |
| `/api/admin/integrations/test` | POST | Valida configuracion minima y discovery de Google |
| `/api/auth/google/config` | GET | Entrega configuracion publica sin secretos |
| `/api/auth/google/start` | GET | Inicia OAuth authorization code flow |
| `/api/auth/google/callback` | GET | Recibe callback, valida state, intercambia code y crea cookie de usuario |

## Estructura de base de datos para credenciales

Este repo usa archivo JSON persistente bajo `APP_DATA_DIR`. Archivo creado automaticamente:

```json
{
  "google": {
    "production": {
      "provider": "google",
      "environment": "production",
      "enabled": true,
      "googleClientId": "16464965879-abcdef.apps.googleusercontent.com",
      "javascriptOrigin": "https://galantesjewelry.com",
      "redirectUri": "https://galantesjewelry.com/api/auth/google/callback",
      "scopes": ["openid", "email", "profile"],
      "encryptedSecrets": {
        "googleClientSecret": "v1:encrypted-aes-gcm-payload",
        "apiKey": "v1:encrypted-aes-gcm-payload",
        "accessToken": "v1:encrypted-aes-gcm-payload",
        "refreshToken": "v1:encrypted-aes-gcm-payload"
      },
      "updatedAt": "2026-04-11T00:00:00.000Z",
      "updatedBy": "admin"
    }
  },
  "audit": []
}
```

Modelo SQL equivalente recomendado para una base de datos real:

```sql
create table integration_credentials (
  id uuid primary key,
  provider varchar(32) not null,
  environment varchar(32) not null,
  enabled boolean not null default false,
  client_id text not null,
  javascript_origin text not null,
  redirect_uri text not null,
  scopes jsonb not null,
  encrypted_client_secret text,
  encrypted_api_key text,
  encrypted_access_token text,
  encrypted_refresh_token text,
  key_version varchar(32) not null default 'v1',
  updated_by varchar(120) not null,
  updated_at timestamptz not null default now(),
  unique (provider, environment)
);

create table integration_audit_log (
  id uuid primary key,
  provider varchar(32) not null,
  environment varchar(32) not null,
  actor varchar(120) not null,
  action varchar(32) not null,
  changed_fields jsonb not null,
  ip_address varchar(64) not null,
  user_agent text not null,
  created_at timestamptz not null default now()
);
```

## Reglas de seguridad

- Nunca exponer Client Secret, refresh token, access token ni API keys al frontend.
- El Client ID puede llegar al navegador, pero se administra desde backend para evitar rebuilds.
- Guardar secretos solo en backend, cifrados en reposo con AES-256-GCM.
- Mantener `INTEGRATIONS_SECRET_KEY` fuera de Git y rotarla con proceso controlado.
- No registrar secretos en logs ni respuestas JSON.
- Validar `redirect_uri` y `origin` antes de guardar.
- Usar `https://` en produccion; `http://localhost:3000` solo en desarrollo.
- Usar `state` OAuth y cookie HttpOnly/SameSite para prevenir CSRF.
- Rotar Client Secret desde Google Cloud si hay filtracion o sospecha.
- Probar discovery desde el panel despues de guardar.
- Mantener valores separados para development, staging y production.
- Limitar scopes a `openid email profile` para login.
- No solicitar Gmail, Drive, Calendar u otros scopes hasta que exista una funcion visible y justificada.

## Errores comunes y como evitarlos

| Error | Causa | Solucion |
| --- | --- | --- |
| `origin_mismatch` | El frontend corre en un origin no registrado | Agregar exactamente `https://galantesjewelry.com`, `https://www.galantesjewelry.com` o `http://localhost:3000` |
| `redirect_uri_mismatch` | El callback enviado no coincide con Google Cloud | Registrar exactamente `/api/auth/google/callback` para cada host usado |
| App no verificada | Falta branding, dominio, politicas o se usan scopes sensibles | Completar homepage, privacy, terms, dominio verificado y usar solo openid/email/profile |
| Secret perdido | Google solo lo muestra al crear/rotar el secret | Rotar Client Secret y actualizarlo desde el panel admin |
| Callback 404 | La ruta registrada no existe en la app | Usar `https://galantesjewelry.com/api/auth/google/callback` en este repo |
| Secret expuesto en frontend | Se uso `NEXT_PUBLIC_` o se incrusto en JS | Mantener secrets en backend y solo retornar Client ID |
| www falla | El login inicia desde www pero solo apex esta registrado | Registrar origin y redirect URI de www, o redirigir www a apex antes de login |

## Fuentes oficiales

- Google OAuth client origins, redirect URIs y manejo de secretos: https://support.google.com/cloud/answer/15549257
- Google OAuth web server flow y coincidencia exacta de redirect URI: https://developers.google.com/identity/protocols/oauth2/web-server
- Google verification requirements: https://support.google.com/cloud/answer/13464321
- Next.js environment variables and server-only secret guidance: node_modules/next/dist/docs/01-app/02-guides/environment-variables.md
- Next.js route handlers: node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md
