# Project Overview

## Status

- Last reviewed: 2026-03-25T20:20:00-04:00
- Repository: `JoelStalin/Galantesjewerly`
- Scope of this memory set: audit, admin repair, session persistence, Docker hardening, Android deployment strategy, Selenium evidence, durable traceability
- Current state: stabilized for the audited scope and validated with lint, build, Docker health checks, proxy smoke checks, and Selenium E2E evidence

## Verified Stack

- Next.js 16.2.1 with App Router
- React 19.2.4
- TypeScript
- Tailwind CSS v4
- `jose` for stateless admin session tokens
- `sharp` for server-side image normalization
- File-backed CMS persisted in `data/cms.json`
- Managed image blobs persisted in `data/blobs`
- Docker multi-stage image, Nginx reverse proxy, optional Cloudflare Tunnel profile

## Runtime Model

- Public site routes render from the file-backed CMS.
- Admin routes mutate the CMS document and managed image storage through Route Handlers.
- Auth is enforced in two places:
  - `proxy.ts` handles optimistic route and API gating.
  - protected admin Route Handlers verify the cookie again before touching data.
- Production-style local startup and Docker both use the Next standalone build.
- `APP_DATA_DIR` defines the writable runtime data root so standalone, Docker, and Termux all point at the same logical storage contract.

## Final Outcome

- Admin image uploads save, persist, re-render, replace cleanly, and delete managed blobs when records are removed or images are replaced.
- Admin session persists across refresh, route changes, browser restart with the same Selenium test profile, and container restart while the secret remains unchanged.
- Docker build succeeds, the production compose stack becomes healthy, and Nginx proxies traffic to the web service correctly.
- Android handling is documented as a split architecture:
  - Docker remains the packaging standard.
  - Android is treated as an operator device or a standalone Node host unless a verified Linux VM is present.

## Primary Evidence

- Lint: `npm run lint`
- Build: `npm run build`
- Health: `http://127.0.0.1:3000/api/health` and `http://127.0.0.1:8080/api/health`
- Docker stack: `docker compose up -d --build`, `docker compose ps`
- Selenium success run: `tests/e2e/artifacts/2026-03-25_20-08-59/`

## Source Ledger

- Consulted on 2026-03-25:
  - Next.js `cookies`, `route`, `proxy`, `output`, `image`, `authentication`
  - Docker multi-stage builds and Docker Desktop Linux / VM guidance
  - Nginx reverse proxy guide
  - Selenium Chrome options and wait strategies
  - Android background execution, app-specific storage, and Android Virtualization Framework
