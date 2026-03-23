# Operations & Deployment Notes

## Infrastructure Overview
- **Core Tech**: Next.js, Node.js (App Router, Tailwind CSS, TypeScript).
- **Environment**: Containerized (Docker Compose) or executed pure via Termux (Samsung Android) as fallback.
- **Web Server**: Nginx (reverse proxy, handles static assets when NextJS is statically exported).
- **Network / Tunneling**: Cloudflare Tunnel (`cloudflared`) to connect internal Docker network/Node to web without exposing local public IP or opening ports manually.

## Secrets & Variables
Check the `.env.example` in the root. 
- **DO NOT EXPOSE DEPLOYMENT SECRETS IN THIS REPO**. 
- Secrets such as `CF_TUNNEL_TOKEN`, `CF_API_TOKEN` are configured directly on the host machine.

## Fallback Plan (Non-Docker, Limited Environment)
If deployed on an Android device via Termux where Docker cannot run:
1. Run `npm run build` with `output: 'export'` configured in `next.config.ts`.
2. Use raw `nginx` or a simple Python/HTTP server to serve `/out`.
3. Run `cloudflared` binary directly in Termux.
