# Admin Audit

## Real Admin Surface

- Login page: `/admin/login`
- Protected dashboard: `/admin/dashboard`
- Redirect shim: `/admin`
- API contract:
  - `POST /api/admin/auth`
  - `POST /api/admin/auth/logout`
  - `GET /api/admin/session`
  - `GET|PUT|DELETE /api/admin/content`
  - `POST /api/admin/upload`

## Real Auth Flow Detected

1. `app/admin/login/page.tsx` posts credentials to `/api/admin/auth`.
2. `app/api/admin/auth/route.ts` compares env credentials and sets `admin_token`.
3. `proxy.ts` blocks unauthenticated access to protected admin routes and protected admin APIs.
4. protected Route Handlers also verify the cookie again through `getAdminSessionFromRequest`.
5. `app/api/admin/auth/logout/route.ts` expires the cookie.
6. `app/api/admin/session/route.ts` exposes a server-side session probe used by the UI and tests.

## Real Image Flow Detected

1. `components/admin/ImageUploader.tsx` accepts a file from an `input type="file"`.
2. The component creates a local preview and sends `FormData` to `/api/admin/upload`.
3. `app/api/admin/upload/route.ts` verifies auth, parses `request.formData()`, and calls `saveProcessedImage`.
4. `lib/storage.ts` validates the file, normalizes it with `sharp`, writes it to `data/blobs`, and returns a managed URL.
5. `app/api/admin/content/route.ts` persists that managed URL into `data/cms.json`.
6. Public and admin UIs render the saved URL.
7. `app/api/image/route.ts` streams the file back from disk with immutable cache headers.

## Reproduced Symptoms

- Public site broken by corrupted CMS data
  - `data/cms.json` had missing homepage sections and missing image references.
- Admin save did not reliably appear on the public homepage
  - reproduced as a stale read caused by `lib/db.ts` process cache not noticing that the JSON file had changed.
- Standalone local production runtime could serve without synced static assets
  - CSS and JS 404s occurred when `.next/standalone/server.js` was run without copying `public` and `.next/static`.
- Standalone writes could target the wrong data directory
  - when started directly, runtime storage drifted to `.next/standalone/data` instead of repo `data/`.
- Docker build failed
  - Alpine package names in the previous Dockerfile did not exist.

## Files Implicated by the Audit

- `app/admin/login/page.tsx`
- `app/admin/dashboard/page.tsx`
- `components/admin/ImageUploader.tsx`
- `app/api/admin/auth/route.ts`
- `app/api/admin/auth/logout/route.ts`
- `app/api/admin/session/route.ts`
- `app/api/admin/content/route.ts`
- `app/api/admin/upload/route.ts`
- `app/api/image/route.ts`
- `lib/auth.ts`
- `lib/db.ts`
- `lib/storage.ts`
- `lib/runtime-paths.ts`
- `data/cms.json`
- `proxy.ts`
- `Dockerfile`
- `docker-compose.yml`
- `docker-compose.dev.yml`
- `infra/nginx/nginx.conf`
- `scripts/start-standalone.mjs`
- `tests/e2e/admin_image_session_flow.py`

## Visible Technical Debt That Remains

- single-admin username/password comparison remains env-based and non-hashed
- file-backed CMS does not provide transactional concurrency control beyond single-file writes
- admin preview still uses a plain `<img>` element to support blob URLs
- Cloudflare dashboard changes still require manual operator action because the upstream platform enforces anti-bot verification
