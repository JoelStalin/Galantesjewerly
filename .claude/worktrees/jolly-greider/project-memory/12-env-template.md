# Environment Template

## Required Variables

### Admin auth

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ADMIN_SECRET_KEY`

### Runtime

- `PORT`
- `HOSTNAME`
- `APP_DATA_DIR`
- `SITE_URL`

### Reverse proxy

- `NGINX_PORT`

### Cloudflare

- `CF_TUNNEL_TOKEN`
- `CF_API_TOKEN`
- `CF_ACCOUNT_ID`

### Selenium

- `E2E_BASE_URL`
- `SELENIUM_PROFILE`
- `SELENIUM_HEADLESS`

### Remote deployment helpers

- `REMOTE_HOST`
- `REMOTE_PORT`
- `REMOTE_USER`
- `REMOTE_APP_DIR`

## Canonical Example

```env
CF_TUNNEL_TOKEN=your_cloudflare_tunnel_token
CF_API_TOKEN=your_cloudflare_api_token
CF_ACCOUNT_ID=your_cloudflare_account_id

ADMIN_USERNAME=admin
ADMIN_PASSWORD=change_me
ADMIN_SECRET_KEY=change_me_32_chars_minimum

APP_DATA_DIR=./data
PORT=3000
HOSTNAME=0.0.0.0
NGINX_PORT=8080
SITE_URL=https://galantesjewelry.com

E2E_BASE_URL=http://127.0.0.1:3000
SELENIUM_PROFILE=Default
SELENIUM_HEADLESS=0

REMOTE_HOST=your.server.ip
REMOTE_PORT=22
REMOTE_USER=ubuntu
REMOTE_APP_DIR=/var/www/galantesjewelry
```

## Rules

- never commit live secrets
- treat repo history and loose local files as exposed if a real secret was ever stored there
- keep `ADMIN_SECRET_KEY` stable across container restarts if session persistence is required
