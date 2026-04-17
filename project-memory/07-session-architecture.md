# Session Architecture

## Final Session Model

- Session type: stateless signed JWT
- Cookie name: `admin_token`
- Signing library: `jose`
- Max age: 30 days
- Cookie scope:
  - `httpOnly: true`
  - `sameSite: "lax"`
  - `path: "/"`
  - `secure` only when the request indicates HTTPS or production semantics

## Login Flow

1. `POST /api/admin/auth` receives `username` and `password`.
2. Credentials are compared against `ADMIN_USERNAME` and `ADMIN_PASSWORD`.
3. A signed token is produced through `signToken`.
4. The response sets the `admin_token` cookie with the shared helper in `lib/auth.ts`.

## Session Validation Flow

- `proxy.ts`
  - redirects unauthenticated admin browser requests to `/admin/login`
  - returns `401` for unauthorized protected admin APIs
  - clears invalid session cookies when verification fails
- Route Handlers
  - `app/api/admin/content/route.ts`
  - `app/api/admin/upload/route.ts`
  - `app/api/admin/session/route.ts`
  - each verifies the cookie again server-side

## Logout Flow

1. Admin UI posts to `POST /api/admin/auth/logout`.
2. The handler reuses shared cookie-expiration options.
3. Browser loses the session on the next request.
4. `proxy.ts` and protected APIs deny further access.

## Persistence Guarantees Verified

- refresh preserves session
- direct navigation to `/admin/dashboard` works while authenticated
- browser restart with the same persistent Selenium profile keeps the session
- logout invalidates access immediately
- container restarts preserve session as long as:
  - `ADMIN_SECRET_KEY` remains unchanged
  - browser keeps the cookie

## Known Simplifications

- single-admin credential model
- no server-side revocation list
- secret rotation invalidates all active tokens

## Evidence

- refresh persistence: `tests/e2e/artifacts/2026-03-25_20-08-59/02_session_after_refresh.png`
- browser restart persistence: `tests/e2e/artifacts/2026-03-25_20-08-59/03_session_after_browser_restart.png`
- logout: `tests/e2e/artifacts/2026-03-25_20-08-59/13_logout_confirmed.png`
- access denied after logout: `tests/e2e/artifacts/2026-03-25_20-08-59/14_access_denied_after_logout.png`

## Sources

- 2026-03-25: Next.js authentication guide recommends stateless sessions signed with a secret stored in env and cookies set on the server with `HttpOnly`, `Secure`, `SameSite`, `Max-Age` or `Expires`, and `Path`
- 2026-03-25: Next.js `cookies` API documents that cookie set and delete actions belong in Server Functions or Route Handlers
- 2026-03-25: Next.js authentication guide recommends Proxy for optimistic checks while keeping real data protection near the data source
