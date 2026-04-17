# Android + Cloudflare OAuth Environment Audit

Date: 2026-04-15

This document consolidates the runtime configuration required for Google OAuth to work correctly when the app is deployed on Android/Termux behind Cloudflare Tunnel.

## Core rule

There are two different addresses in this architecture:

1. Bind address for Node.js:
   - `HOSTNAME=0.0.0.0`
   - This is only for the server to listen on the device.
2. Public canonical URL for OAuth and browser redirects:
   - `https://galantesjewelry.com`
   - `https://admin.galantesjewelry.com`
   - These must be used for cookies, redirects, and Google OAuth.

Never use `0.0.0.0` as a browser entrypoint or OAuth callback host.

## Cloudflare Tunnel

Public hostnames must target loopback on the Android host:

- `galantesjewelry.com` -> `http://127.0.0.1:3000`
- `admin.galantesjewelry.com` -> `http://127.0.0.1:3000`
- `www.galantesjewelry.com` -> `http://127.0.0.1:3000` (recommended)

Do not point the tunnel to `0.0.0.0:3000`.

## Required production environment variables

These values must exist in the Android host `.env` used by the running process:

```env
HOSTNAME=0.0.0.0
PORT=3000
NODE_ENV=production
APP_DATA_DIR=/data/data/com.termux/files/home/galantesjewelry/data

SITE_URL=https://galantesjewelry.com
GOOGLE_PUBLIC_BASE_URL=https://galantesjewelry.com
NEXT_PUBLIC_SITE_URL=https://galantesjewelry.com

GOOGLE_SESSION_SECRET=<32+ chars>
ADMIN_SECRET_KEY=<32+ chars>
INTEGRATIONS_SECRET_KEY=<32+ chars>
APPOINTMENT_ENCRYPTION_KEY=<32+ chars>

GOOGLE_OAUTH_CLIENT_ID=<google web app client id>
GOOGLE_OAUTH_CLIENT_SECRET=<google web app client secret>
GOOGLE_OAUTH_JAVASCRIPT_ORIGIN=https://galantesjewelry.com
GOOGLE_OAUTH_REDIRECT_URI=https://galantesjewelry.com/auth/google/callback
GOOGLE_OAUTH_SCOPES=openid email profile
```

## Google Cloud Console values

### Authorized JavaScript origins

- `https://galantesjewelry.com`
- `https://admin.galantesjewelry.com`
- `http://localhost:3000`

### Authorized redirect URIs

- `https://galantesjewelry.com/auth/google/callback`
- `https://admin.galantesjewelry.com/api/admin/google/oauth/callback`
- `http://localhost:3000/auth/google/callback`

Add `http://localhost:3000/api/admin/google/oauth/callback` only if the admin owner OAuth flow is tested locally.

## OAuth route model used by this repo

### Public customer login

- Start: `/api/auth/google/start`
- Callback: `/auth/google/callback`

Google must therefore receive:

- `redirect_uri=https://galantesjewelry.com/auth/google/callback`

### Admin owner account connection

- Start: `/api/admin/google/oauth/start`
- Callback: `/api/admin/google/oauth/callback`

Google must therefore receive:

- `redirect_uri=https://admin.galantesjewelry.com/api/admin/google/oauth/callback`

The admin callback is derived from the current request host and must stay on the same admin domain so cookies and admin session stay valid.

## Config precedence

The runtime resolves Google config in this order:

1. Stored integration settings from `APP_DATA_DIR/integrations.json`
2. Environment variables as bootstrap fallback

Important consequences:

- Public login redirect URI can still come from stored admin settings if they were saved in the dashboard.
- Admin owner OAuth callback should not reuse the stored public redirect URI.
- If production still redirects admin OAuth to `https://galantesjewelry.com/auth/google/callback`, the deployed code is stale or the wrong service was restarted.

## Known failure signatures

### `https://0.0.0.0:3000/?google_login=error`

Cause:

- the running app is resolving its public base URL from `0.0.0.0`
- or the browser started the flow from `0.0.0.0`
- or the process was not restarted after environment fixes

Fix:

1. set `SITE_URL`, `GOOGLE_PUBLIC_BASE_URL`, and `NEXT_PUBLIC_SITE_URL` to `https://galantesjewelry.com`
2. restart the Node process on Android
3. clear browser cookies for `galantesjewelry.com`, `admin.galantesjewelry.com`, `localhost`, and `0.0.0.0`
4. start the flow from the public domain, never from `0.0.0.0`

### Admin OAuth returns to public callback

Cause:

- old code is still deployed

Fix:

1. deploy the latest admin OAuth host fix
2. verify `/api/admin/google/oauth/start?environment=production` returns a `Location` header containing:
   - `redirect_uri=https://admin.galantesjewelry.com/api/admin/google/oauth/callback`

## Functional validation checklist

After every deploy:

1. `https://galantesjewelry.com/api/health` returns `200`
2. public start route returns `307` to Google with public callback:
   - `/api/auth/google/start?returnTo=%2F`
3. admin start route returns `307` to Google with admin callback:
   - `/api/admin/google/oauth/start?environment=production`
4. browser testing is performed from the real public domains
5. no browser test is started from `0.0.0.0`

## Restart checklist on Android/Termux

Whenever `.env` changes:

1. stop the running Node process or service
2. reload the environment file
3. start the standalone server again
4. verify `/api/health`
5. retest the OAuth start routes

If Cloudflare hostname mappings changed:

1. update them manually in the Cloudflare dashboard
2. save changes
3. restart `cloudflared` if needed

## 2026-04-15 production SSH verification

Production was audited directly over SSH on the Android/Termux host.

### Host and services

- SSH host: `ssh.galantesjewelry.com` via Cloudflare Access
- App path: `/data/data/com.termux/files/home/galantesjewelry`
- App service: `/data/data/com.termux/files/usr/var/service/galantesjewelry`
- Tunnel service: `/data/data/com.termux/files/usr/var/service/cloudflared`

### Runtime corrections applied on host

The Android `.env` was updated so the running app uses canonical public URLs instead of bind addresses:

```env
NODE_ENV=production
SITE_URL=https://galantesjewelry.com
GOOGLE_PUBLIC_BASE_URL=https://galantesjewelry.com
NEXT_PUBLIC_SITE_URL=https://galantesjewelry.com
GOOGLE_OAUTH_JAVASCRIPT_ORIGIN=https://galantesjewelry.com
GOOGLE_OAUTH_REDIRECT_URI=https://galantesjewelry.com/auth/google/callback
```

The host build also required:

```sh
export NODE_OPTIONS='--max-old-space-size=2048'
npm run build:android
```

### Production checks that passed

1. `http://127.0.0.1:3000/api/health` returned `200`
2. `https://galantesjewelry.com/api/health` returned `200`
3. public OAuth start returned Google with:
   - `redirect_uri=https://galantesjewelry.com/auth/google/callback`
4. admin OAuth start returned Google with:
   - `redirect_uri=https://admin.galantesjewelry.com/api/admin/google/oauth/callback`
5. Selenium smoke from a cloned Chrome profile validated:
   - public storefront rendered
   - admin panel loaded
   - the "Connect Google Owner" button opened Google with the correct admin callback

### Important operational note

`APP_DATA_DIR/integrations.json` may keep a public redirect URI for customer login in production. That is valid.
The admin owner OAuth flow must still derive its callback from the request host and never reuse the stored public callback.
