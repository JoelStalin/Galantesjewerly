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
1. Keep `output: 'standalone'` and build the app as a Node.js standalone server.
2. Copy the standalone bundle together with `public`, `.next/static`, and the persistent `data` directory.
3. Start `node server.js` in Termux with `NODE_ENV=production`, `PORT=3000`, and writable `data/blobs`.
4. Run the `cloudflared` binary directly in Termux only if Docker is not part of the environment.

## Standard Container Flow
1. `web` serves the Next.js standalone server on internal port `3000`.
2. `nginx` proxies public HTTP traffic to `web` and forwards the required headers.
3. `cloudflared` publishes the Nginx service to Cloudflare without exposing the Node container directly.
