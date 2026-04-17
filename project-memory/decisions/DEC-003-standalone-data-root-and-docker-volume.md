# DEC-003 Standalone Data Root and Docker Volume

## ID

- Decision: DEC-003
- Status: accepted
- Date: 2026-03-25

## Context

- Problem: standalone local production, Docker, and Termux needed to operate on the same persistent data contract
- Constraints:
  - Next standalone build must remain the production deployment artifact
  - uploads must survive container recreation
  - the repo already expected a writable `data/` directory
- Alternatives considered:
  - rely on `process.cwd()` only
  - write into the container filesystem without a mounted volume
  - maintain separate path logic per runtime

## Decision

Introduce `APP_DATA_DIR` as the single runtime storage root, default to repo `data` locally, mount `./data:/app/data` in Docker, and launch standalone mode through a repo-aware helper that syncs required runtime assets before boot.

## Consequences

- Positive effects:
  - consistent persistence contract everywhere
  - local production start mirrors the Docker runtime closely
  - health checks can validate the same storage root concept in every environment
- Tradeoffs:
  - operators must keep `APP_DATA_DIR` aligned with real writable storage
  - build output still depends on a fresh `npm run build`
- Operational impact:
  - `data/` is now the canonical runtime state boundary for backup and migration

## Evidence

- Validation:
  - local and Docker health endpoints reported the expected storage roots
  - Docker web and Nginx services became healthy
- Artifact:
  - `project-memory/evidence/test-runs-index.md`
- Related change log entries:
  - `CHG-001`
  - `CHG-008`
  - `CHG-009`
  - `CHG-010`
  - `CHG-011`
  - `CHG-012`
  - `CHG-013`

## Sources

- Source: Next.js `output` docs
  - Consulted on: 2026-03-25
  - Applied conclusion: standalone output is the correct deployment artifact
- Source: Docker multi-stage build docs
  - Consulted on: 2026-03-25
  - Applied conclusion: runtime image should only carry the final build artifacts
- Source: Nginx reverse proxy docs
  - Consulted on: 2026-03-25
  - Applied conclusion: forwarded headers and `proxy_pass` are required for correct upstream behavior
