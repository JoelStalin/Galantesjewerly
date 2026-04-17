# Galante's Jewelry by the Sea

Next.js 16 App Router storefront with an authenticated admin panel, managed image uploads, persistent file-backed CMS storage, Docker packaging, and an Android-oriented deployment strategy.

## Stack

- Next.js 16.2.1 with App Router
- React 19.2.4
- TypeScript
- Tailwind CSS v4
- JWT cookie auth with `jose`
- Image processing with `sharp`
- Persistent CMS data in `data/cms.json` and `data/blobs`
- Docker + Nginx + optional Cloudflare Tunnel

## Environment

Create `.env` from `.env.example` and define at minimum:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change_me
ADMIN_SECRET_KEY=change_me_32_chars_minimum
PORT=3000
NGINX_PORT=8080
SITE_URL=https://galantesjewelry.com
```

Do not commit live secrets. The current repository history and working tree must be treated as exposed if a real token or password was committed.

## Local Development

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:3000`.

## Local Production Runtime

Build the standalone server and run it with the repository start helper:

```bash
npm run build
npm run start
```

`npm run start` launches `.next/standalone/server.js`. This keeps local production behavior aligned with Docker and Termux.

## Docker

Development container:

```bash
docker compose -f docker-compose.dev.yml up --build
```

Production-style stack with Nginx:

```bash
docker compose up -d --build
```

Optional Cloudflare Tunnel:

```bash
docker compose --profile tunnel up -d --build
```

Useful commands:

```bash
docker compose ps
docker compose logs -f web
docker compose logs -f nginx
```

## Selenium E2E

Prepare the persistent cloned Chrome profile:

```bash
python tests/e2e/profile_manager.py --profile Default
```

Run the main admin suite:

```bash
python tests/e2e/admin_image_session_flow.py
```

Artifacts are written to `tests/e2e/artifacts/YYYY-MM-DD_HH-mm-ss/`.

## Android-Oriented Deployment

The repository remains fully dockerized, but Android itself is not treated as a first-class Docker host. The supported patterns are:

- Android as operator device controlling a remote Linux Docker host.
- Android Termux running the standalone Node bundle directly when Docker is not available.
- Android with a Linux VM only when the VM explicitly provides a supported Docker environment.

Detailed architecture, decisions, and evidence live in `project-memory/`.

## Google Cloud Deployment (<= USD 30) + Google Pay

Use the automation guide and scripts here:

- `docs/deployment/GCP_AUTODEPLOY_AND_GOOGLE_PAY.md`
- `scripts/gcp/deploy-gcp-budget.ps1`
- `scripts/odoo/enable_google_pay.py`

## Long-Term Technical Memory

Use the following sources together:

- `project-memory/` for durable engineering traceability
- `context/operations/` for operational architecture notes
- `tests/e2e/` for executable validation assets
