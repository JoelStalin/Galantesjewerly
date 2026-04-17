# Root Cause

## Primary Root Cause

`lib/db.ts` cached `data/cms.json` in process memory and reused that cache without checking whether another worker or request had already rewritten the file. The result was a split-brain runtime:

- admin APIs could write the new record and image URL successfully
- the public homepage could keep rendering stale in-memory content until process restart

This was the real cause behind the main symptom "the photo saves in admin but does not reliably appear after reload/public navigation".

## Root-Cause Proof

- Before the fix:
  - a temporary featured item created through the admin API did not appear in homepage HTML fetched immediately afterward
  - this was reproduced during debugging and captured in failing artifact runs
- After the fix:
  - `lib/db.ts` compared the file `mtime` before serving the cache
  - the same end-to-end flow rendered the created item and managed image on the public homepage
  - the final Selenium run `2026-03-25_20-08-59` passed `visualizacion_publica_inicial` and `visualizacion_publica_reemplazo`

## Secondary Causes

### Secondary Cause 1: corrupted CMS seed state

`data/cms.json` had been left in a damaged state with:

- missing `philosophy`, `review`, and `cta` sections
- a nonexistent `/gold_banner.jpg` reference
- a missing managed blob reference in featured content

That state broke the public homepage independently of the upload flow.

### Secondary Cause 2: standalone runtime path drift

Running the standalone server directly caused filesystem writes to resolve under `.next/standalone/data` instead of the repo `data` directory. This made local production behavior diverge from the repository state and from Docker volume expectations.

### Secondary Cause 3: missing standalone asset sync

`.next/standalone` did not contain synced `public` or `.next/static` assets when launched through a naive `node server.js`, producing broken CSS and JS in local production validation.

### Secondary Cause 4: invalid Docker base-package assumptions

The Dockerfile requested Alpine packages that were not present, so the container image could not even be built reliably before the Docker refactor.

## Final Corrective Strategy

- keep the file-backed CMS
- add `APP_DATA_DIR` as the single storage contract
- make cache invalidation observe file `mtime`
- keep stateless JWT cookie sessions with request-aware cookie flags
- protect admin routes in `proxy.ts` and protect admin Route Handlers again server-side
- use managed image URLs backed by `data/blobs`
- use a standalone launcher that syncs required runtime assets before boot
