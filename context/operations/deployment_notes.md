# Operations & Deployment Notes

## Infrastructure Overview
- **Core Tech**: Next.js, Node.js (App Router, Tailwind CSS, TypeScript).
- **Environment**: Containerized (Docker Compose) or executed pure via Termux (Samsung Android) as fallback.
- **Web Server**: Nginx reverse proxy in front of the Next.js container.
- **Network / Tunneling**: Cloudflare Tunnel (`cloudflared`) published against the internal Nginx service.

## Secrets & Variables
Store secrets only in `.env` on the host:
- `CF_TUNNEL_TOKEN`
- `CF_API_TOKEN`
- `CF_ACCOUNT_ID`

Do not commit deployment secrets to the repository.

## Fallback Plan (Non-Docker, Limited Environment)
If deployed on an Android device via Termux where Docker cannot run:
1. Run `npm run build` with `output: 'export'` configured in `next.config.ts`.
2. Use raw `nginx` or a simple Python/HTTP server to serve `/out`.
3. Run `cloudflared` binary directly in Termux.

## Standard Container Flow
1. `web` serves the Next.js application on internal port `3000`.
2. `nginx` proxies public HTTP traffic to `web`.
3. `cloudflared` publishes the Nginx service to Cloudflare without opening host ports manually.
