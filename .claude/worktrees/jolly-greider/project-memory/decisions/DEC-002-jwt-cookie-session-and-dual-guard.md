# DEC-002 JWT Cookie Session and Dual Guard

## ID

- Decision: DEC-002
- Status: accepted
- Date: 2026-03-25

## Context

- Problem: the admin panel needed durable session persistence until manual logout, with real server-side protection for admin routes and APIs
- Constraints:
  - no React-only auth state
  - no localStorage-only security model
  - route protection had to survive refresh, direct URL entry, and browser restart
- Alternatives considered:
  - full auth framework
  - database-backed sessions
  - client-only auth state

## Decision

Use a stateless JWT cookie signed with `jose`, set and cleared in Route Handlers, validated optimistically in `proxy.ts`, and validated again inside protected admin Route Handlers before data access.

## Consequences

- Positive effects:
  - simple session persistence with no extra datastore
  - route protection works before page render
  - APIs remain protected even if proxy rules are bypassed or changed later
- Tradeoffs:
  - no server-side token revocation list
  - secret rotation expires all active sessions
- Operational impact:
  - `ADMIN_SECRET_KEY` becomes a high-value secret that must remain stable across routine restarts

## Evidence

- Validation:
  - refresh, browser restart, logout, and post-logout denial all passed in Selenium
- Artifact:
  - `tests/e2e/artifacts/2026-03-25_20-08-59/result.json`
- Related change log entries:
  - `CHG-004`
  - `CHG-005`
  - `CHG-007`

## Sources

- Source: Next.js authentication guide
  - Consulted on: 2026-03-25
  - Applied conclusion: stateless sessions with signed cookies are valid for this scope, and Proxy is suitable for optimistic checks
- Source: Next.js cookies API
  - Consulted on: 2026-03-25
  - Applied conclusion: cookie mutation belongs in Route Handlers and must be server-side
