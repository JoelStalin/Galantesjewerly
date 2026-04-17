# Repository Map

## Root Structure

- `app/`: Next.js App Router routes and API handlers
- `components/`: public UI and admin form helpers
- `lib/`: auth, CMS persistence, image storage, runtime path helpers
- `data/`: persisted CMS JSON and blob storage
- `infra/nginx/`: reverse proxy configuration
- `scripts/`: bootstrap, standalone runtime, Termux deployment helpers
- `tests/e2e/`: Selenium suite, persistent profile helpers, artifacts, requirements
- `context/operations/`: operational notes that must survive future agent sessions
- `project-memory/`: durable engineering memory introduced by this intervention

## Public Routes

- `/` -> `app/page.tsx`
- `/about` -> `app/about/page.tsx`
- `/bridal` -> `app/bridal/page.tsx`
- `/collections` -> `app/collections/page.tsx`
- `/contact` -> `app/contact/page.tsx`
- `/journal` -> `app/journal/page.tsx`
- `/repairs` -> `app/repairs/page.tsx`

## Admin Routes

- `/admin` -> `app/admin/page.tsx`
- `/admin/login` -> `app/admin/login/page.tsx`
- `/admin/dashboard` -> `app/admin/dashboard/page.tsx`

## API Routes

- `/api/admin/auth` -> login and cookie issuance
- `/api/admin/auth/logout` -> logout and cookie invalidation
- `/api/admin/session` -> server-side session probe
- `/api/admin/content` -> settings, sections, featured item CRUD
- `/api/admin/upload` -> authenticated image upload and normalization
- `/api/image` -> managed image binary bridge
- `/api/health` -> runtime storage writability health probe

## Shared Libraries

- `lib/auth.ts`
  - stateless session token signing and verification
  - secure cookie option resolution
  - direct request-cookie parsing for Route Handlers
- `lib/db.ts`
  - file-backed CMS reads and writes
  - managed image cleanup when references disappear
  - mtime-based cache invalidation to prevent stale cross-worker reads
- `lib/storage.ts`
  - upload validation
  - image normalization through `sharp`
  - storage id generation and image deletion
- `lib/runtime-paths.ts`
  - unified `APP_DATA_DIR` resolution for standalone, Docker, and Termux

## Persistence Layout

- `data/cms.json` -> active CMS data
- `data/cms_master.json` -> seed/reference snapshot
- `data/blobs/` -> managed image files

## Infra and Runtime Files

- `Dockerfile` -> multi-stage standalone image
- `docker-compose.yml` -> production-style stack with `web`, `nginx`, optional `cloudflared`
- `docker-compose.dev.yml` -> development container
- `.dockerignore` -> build context pruning
- `infra/nginx/nginx.conf` -> reverse proxy to `web:3000` and `/healthz`
- `proxy.ts` -> route and API gate
- `scripts/start-standalone.mjs` -> repo-aware standalone launcher
- `scripts/start_app.sh` -> Termux standalone start helper
- `scripts/deploy_termux.sh` -> Termux bundle deployment
- `scripts/bootstrap_remote.sh` -> Docker-first bootstrap with standalone fallback

## Test Assets

- `tests/e2e/admin_image_session_flow.py` -> canonical admin/image/session suite
- `tests/e2e/public_smoke.py` -> public and auth entry smoke check
- `tests/e2e/profile_runtime.py` -> persistent cloned profile runtime utilities
- `tests/e2e/profile_manager.py` -> profile preparation CLI
- `tests/e2e/requirements.txt` -> Python package pin for Selenium
- `tests/e2e/artifacts/` -> execution evidence per run
