# Galante's Jewelry by the Sea 🌊

A high-performance, mobile-first, Next.js web application tailored for a luxury "barefoot" aesthetic jewelry boutique located in Islamorada, Florida Keys.

## Architecture & Stack
- **Framework**: Next.js 15 (App Router, React 19)
- **Styling**: Tailwind CSS (Native v4 with CSS variables)
- **Infrastructure**: Docker + Nginx proxy
- **Networking**: Cloudflare Tunnel (`cloudflared`) to run securely without exposing host IP.

This architecture was chosen to guarantee performance (with static generation logic), portability to constrained environments, and strong aesthetic consistency with the brand's premium identity.

## Prerequisites
- Node.js 20+ (if running bare metal)
- Docker & Docker Compose (for containerized deployment)
- Cloudflare Tunnel token (if exposing via Cloudflare)

## Environment Variables
Copy `.env.example` to `.env` and fill the variables:
- `CF_TUNNEL_TOKEN`: Your cloudflare tunnel token.
- `APP_ENV`, `PORT`, `SITE_URL` etc.
- No real credentials should be committed to git.

## Local Development
1. Install dependencies: `npm install`
2. Run development server: `npm run dev`
3. View at `http://localhost:3000`

## Build & Production (Docker)
This is the recommended deployment method.
1. Make sure `.env` contains `CF_TUNNEL_TOKEN`.
2. Run `docker compose up -d --build`.
3. The stack will bring up the Web app (NextJS standalone), Nginx proxying `/_next/static`, and Cloudflare Tunnel securely connecting to the edge.

## Remote SSH Deployment
We provide basic scripts to sync files and bootstrap on a remote host (e.g., an Ubuntu server or Termux on Android):
1. Configure `REMOTE_HOST`, `REMOTE_PORT`, `REMOTE_USER`, and `REMOTE_APP_DIR` in `.env`.
2. Run `./scripts/deploy_remote.sh` (Requires rsync & SSH access, preferably via key).
3. On the server, run `./scripts/bootstrap_remote.sh`.

## Fallback Mode (Samsung / Termux Environment)
If Docker cannot be run (e.g., Termux without proper chroot/proot on Android), follow this fallback:
1. Run `npm install`.
2. Ensure `output: 'export'` is set in `next.config.ts`.
3. Run `npm run build`. This generates a fully static HTML/JS site in the `/out` directory.
4. Serve the `/out` directory with a lightweight web server like Pythons `python -m http.server 8080`, native Nginx on Termux, or Node's `serve`.
5. For external access, `cloudflared` can be run statically in Termux: `cloudflared tunnel run --token YOUR_TOKEN`.

## Cloudflare Tunnel connection
By running the tunnel inside Docker or bare metal, the application securely handshakes with Cloudflare without opening router ports.
Scripts exist under `/infra/cloudflare` to automate DNS creation using API tokens. Keep manually generated token strings in `.env` only.

## AI Operative Memory (`/context`)
The `/context` folder contains the long-term operative memory, brand book, business logic, customer insights schema, and AI prompts. This replaces hardcoded business definitions with raw data structures that any future AI agent running locally can parse using `/lib/context-reader.ts`.
Backup this folder systematically.

## Daily Operations & Content Management
- **Brand/Copy**: Edit directly in the React components (`app/`).
- **AI Rules**: Edit markdown files in `/context/prompts/` and `/context/brand/`.
- **Tunnel Logs**: `docker logs galantes_tunnel`
- **Lead Exports**: Forms currently hit placeholders. Implement an API route dumping to a local DB or email.
