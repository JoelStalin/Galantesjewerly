# Docker Architecture

## Goal

Keep the repository fully dockerized while preserving the same persistent data contract used by standalone and Termux fallbacks.

## Final Build Design

- `Dockerfile` uses a multi-stage build:
  - `deps`
  - `builder`
  - `runner`
- The runner image copies:
  - `public/`
  - `data/`
  - `.next/standalone/`
  - `.next/static/`
- The runner exports:
  - `NODE_ENV=production`
  - `PORT=3000`
  - `HOSTNAME=0.0.0.0`
  - `APP_DATA_DIR=/app/data`

## Final Service Topology

### Production-style compose

- `web`
  - builds from the Dockerfile
  - exposes port `3000` to the internal Docker network
  - mounts `./data:/app/data`
  - uses `/api/health` as its health probe
- `nginx`
  - listens on host `${NGINX_PORT:-8080}`
  - proxies to `web:3000`
  - exposes `/healthz` mapped to `/api/health`
- `cloudflared`
  - optional service behind the `tunnel` profile
  - depends on healthy `nginx`

### Development compose

- `web-dev`
  - mounts the repo
  - runs `npm ci && npm run dev`
  - shares `./data:/app/data`

## Persistence Model

- uploads persist because `./data` is mounted into `/app/data`
- rebuilding or recreating containers does not wipe `data/cms.json` or `data/blobs`
- the same storage contract is used by standalone mode through `APP_DATA_DIR`

## Health and Readiness

- application health endpoint: `GET /api/health`
- Nginx health endpoint: `GET /healthz`
- validated results:
  - local Docker health response returned `/app/data/blobs`
  - `docker compose ps` showed healthy `galantes_web` and `galantes_nginx`

## Reverse Proxy Notes

- Nginx forwards:
  - `Host`
  - `X-Real-IP`
  - `X-Forwarded-For`
  - `X-Forwarded-Proto`
- this preserves the request context required by the auth cookie helper to decide whether `secure` should be enabled

## Evidence

- build and startup: indexed in `project-memory/evidence/test-runs-index.md`
- proxy health and auth smoke: indexed in `project-memory/evidence/test-runs-index.md`

## Sources

- 2026-03-25: Docker multi-stage builds allow multiple `FROM` stages so only the final runtime artifacts are copied into the final image
- 2026-03-25: Next.js `output: "standalone"` automatically creates `.next/standalone` for production deployment
- 2026-03-25: Nginx `proxy_pass` and `proxy_set_header` are the canonical reverse-proxy directives used by the final config
