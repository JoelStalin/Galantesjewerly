# Galante's Jewelry by the Sea 🌊

A high-performance, mobile-first Next.js web application for a luxury jewelry boutique in Islamorada, Florida Keys.

## Architecture & Stack
- **Framework**: Next.js 16 (App Router, React 19)
- **Styling**: Tailwind CSS (Native v4 with CSS variables)
- **Infrastructure**: Docker + Nginx reverse proxy
- **Networking**: Cloudflare Tunnel (`cloudflared`)
- **Operative Memory**: `/context`

This architecture keeps the app portable, secure, and ready for private deployment without exposing the host directly to the public internet.

## Prerequisites
- Node.js 20+ (if running bare metal)
- Docker & Docker Compose (for containerized deployment)
- Cloudflare Tunnel token (if exposing via Cloudflare)

## Environment Variables
Create a `.env` file with at least:

```env
CF_TUNNEL_TOKEN=your_cloudflare_tunnel_token
PORT=3000
SITE_URL=https://galantesjewelry.com
```

Do not commit secrets.

## Local Development
1. Install dependencies: `npm install`
2. Run development server: `npm run dev`
3. View at `http://localhost:3000`

## Build & Production (Docker)
1. Make sure `.env` contains `CF_TUNNEL_TOKEN`.
2. Run `docker compose up -d --build`.
3. Services started:
   - `web`: Next.js app
   - `nginx`: reverse proxy
   - `cloudflared`: Cloudflare Tunnel

## Remote SSH Deployment
1. Configure `REMOTE_HOST`, `REMOTE_PORT`, `REMOTE_USER`, and `REMOTE_APP_DIR` in `.env`.
2. Run `./scripts/deploy_remote.sh` (Requires rsync & SSH access, preferably via key).
3. On the server, run `./scripts/bootstrap_remote.sh`.

## Cloudflare Tunnel
The tunnel runs as a dedicated container:

```bash
docker compose logs -f cloudflared
```

Traffic flow:

Cloudflare Edge → `cloudflared` → `nginx` → `web`

## AI Operative Memory (`/context`)
The `/context` folder stores:
- brand book
- voice and tone
- business strategy
- prompts
- customer/data schemas
- deployment notes

## Daily Operations & Content Management
- Brand/copy: edit in `app/`
- AI rules: edit in `context/prompts/` and `context/brand/`
- Tunnel logs: `docker logs galantes_tunnel`
- Nginx logs: `docker logs galantes_nginx`
