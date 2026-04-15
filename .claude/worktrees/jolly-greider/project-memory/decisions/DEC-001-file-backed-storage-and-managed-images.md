# DEC-001 File-Backed Storage and Managed Images

## ID

- Decision: DEC-001
- Status: accepted
- Date: 2026-03-25

## Context

- Problem: the admin panel needed persistent image uploads without introducing a new database or object-storage platform during this intervention
- Constraints:
  - the repo already used a file-backed CMS
  - Docker persistence had to remain reproducible
  - Android fallback paths could not depend on a heavyweight new service
- Alternatives considered:
  - external object storage
  - database-backed media table
  - leaving image paths as arbitrary external URLs

## Decision

Keep the file-backed CMS and store admin-managed binaries under `APP_DATA_DIR/blobs`, while persisting only managed image URLs in `data/cms.json`. Serve those binaries through `/api/image` and cleanup orphaned managed files when records change or are deleted.

## Consequences

- Positive effects:
  - no new infrastructure dependency
  - stable persistence across standalone, Docker, and Termux
  - deterministic cleanup of replaced images
- Tradeoffs:
  - single-node filesystem storage only
  - no deduplication or object-versioning
- Operational impact:
  - the `data/` directory becomes a protected asset that must be backed up

## Evidence

- Validation:
  - Selenium save, reload, replace, and cleanup cases passed
- Artifact:
  - `tests/e2e/artifacts/2026-03-25_20-08-59/result.json`
- Related change log entries:
  - `CHG-002`
  - `CHG-003`
  - `CHG-006`
  - `CHG-014`
  - `CHG-016`

## Sources

- Source: Next.js Route Handlers docs
  - Consulted on: 2026-03-25
  - Applied conclusion: file upload parsing through `request.formData()` is first-class in Route Handlers
- Source: Next.js Image docs
  - Consulted on: 2026-03-25
  - Applied conclusion: public rendering can stay optimized while admin preview remains a plain `<img>` for blob URL support
