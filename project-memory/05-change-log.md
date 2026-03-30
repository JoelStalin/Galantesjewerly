# Change Log

## CHG-001

- Timestamp: 2026-03-25T18:35:00-04:00
- File: `lib/runtime-paths.ts`
- Function or block: `getDataRoot`
- Previous state: runtime code derived storage paths from `process.cwd()` only
- Change applied: introduced `APP_DATA_DIR` resolution with repo-data fallback
- Reason: unify storage across standalone, Docker, and Termux
- Expected impact: every runtime writes to the same logical data root
- Possible risk: wrong env value can still point to an invalid directory
- Validation performed: `GET /api/health` reported repo `data/blobs` locally and `/app/data/blobs` in Docker
- Evidence: `tests/e2e/artifacts/2026-03-25_20-08-59/report.md`
- Related decision: `DEC-003-standalone-data-root-and-docker-volume.md`
- Related test: local health probe, Docker health probe

## CHG-002

- Timestamp: 2026-03-25T18:42:00-04:00
- File: `lib/storage.ts`
- Function or block: upload validation, storage id generation, managed file deletion
- Previous state: upload handling lacked complete server-side validation and stable data-root indirection
- Change applied: added size, MIME, extension validation, invalid-image handling, normalized names, `APP_DATA_DIR` support, and managed delete helpers
- Reason: make image upload deterministic and safe
- Expected impact: admin uploads save only valid images and cleanup works after replace/delete
- Possible risk: stricter validation rejects files previously accepted
- Validation performed: Selenium cases `guardado_exitoso_con_imagen`, `reemplazo_de_imagen`, and cleanup
- Evidence: `tests/e2e/artifacts/2026-03-25_20-08-59/06_after_first_save.png`
- Related decision: `DEC-001-file-backed-storage-and-managed-images.md`
- Related test: full admin image/session flow

## CHG-003

- Timestamp: 2026-03-25T18:48:00-04:00
- File: `lib/db.ts`
- Function or block: `readDB`, `writeDB`, `performInit`
- Previous state: memory cache never revalidated against file changes, and corrupted `cms.json` states were allowed to linger
- Change applied: added `mtime`-based cache invalidation, stable initialization, and managed-image cleanup after content updates
- Reason: fix stale public rendering after admin save and remove orphan blobs
- Expected impact: homepage immediately sees admin edits and replaced images no longer leak files
- Possible risk: additional `stat` call on reads
- Validation performed: reproduced stale-read failure before fix and success after fix; final Selenium public-render cases passed
- Evidence: `tests/e2e/artifacts/2026-03-25_20-08-59/08_public_render_initial.png`
- Related decision: `DEC-001-file-backed-storage-and-managed-images.md`
- Related test: public render checks before and after replace

## CHG-004

- Timestamp: 2026-03-25T18:53:00-04:00
- File: `lib/auth.ts`
- Function or block: cookie option helpers and request session parser
- Previous state: auth helpers were not request-aware enough for consistent local HTTP and reverse-proxy usage
- Change applied: added `shouldUseSecureCookies`, `getAdminCookieOptions`, `getExpiredAdminCookieOptions`, and `getAdminSessionFromRequest`
- Reason: ensure cookie persistence works locally while remaining secure behind HTTPS
- Expected impact: login persists on local HTTP, Docker+Nginx, and HTTPS deployments
- Possible risk: deployments with incorrect forwarded headers can set the wrong `secure` flag
- Validation performed: refresh persistence, browser restart persistence, logout, and access denial after logout
- Evidence: `tests/e2e/artifacts/2026-03-25_20-08-59/03_session_after_browser_restart.png`
- Related decision: `DEC-002-jwt-cookie-session-and-dual-guard.md`
- Related test: Selenium session cases

## CHG-005

- Timestamp: 2026-03-25T18:58:00-04:00
- File: `app/api/admin/content/route.ts`
- Function or block: route-level auth guard and CRUD handlers
- Previous state: admin data endpoint relied too heavily on outer route gating
- Change applied: added explicit server-side session validation before read and write operations
- Reason: protected data must be guarded at the handler boundary, not only by proxy redirects
- Expected impact: unauthorized API access is rejected even if proxy coverage changes
- Possible risk: duplicated auth logic must stay aligned with cookie format
- Validation performed: Selenium `acceso_denegado_post_logout`
- Evidence: `tests/e2e/artifacts/2026-03-25_20-08-59/14_access_denied_after_logout.png`
- Related decision: `DEC-002-jwt-cookie-session-and-dual-guard.md`
- Related test: protected API denial after logout

## CHG-006

- Timestamp: 2026-03-25T19:00:00-04:00
- File: `app/api/admin/upload/route.ts`
- Function or block: authenticated upload endpoint
- Previous state: upload path did not provide a clean auth boundary and error mapping was weak
- Change applied: enforced session check, standardized `FormData` parsing, and mapped validation failures to HTTP 400
- Reason: make admin image uploads predictable and debuggable
- Expected impact: clear feedback for invalid uploads and no anonymous write access
- Possible risk: clients depending on vague server errors now receive explicit validation failures
- Validation performed: Selenium upload, save, replace, and preview cases
- Evidence: `tests/e2e/artifacts/2026-03-25_20-08-59/05_first_upload_preview.png`
- Related decision: `DEC-001-file-backed-storage-and-managed-images.md`
- Related test: full admin image/session flow

## CHG-007

- Timestamp: 2026-03-25T19:02:00-04:00
- Files: `app/api/admin/auth/route.ts`, `app/api/admin/auth/logout/route.ts`, `app/api/admin/session/route.ts`
- Function or block: login, logout, session probe
- Previous state: session lifecycle lacked a stable probe endpoint and cookie clearing symmetry
- Change applied: aligned issuance and deletion with shared cookie helpers and added `/api/admin/session`
- Reason: support UI/session restoration and E2E verification
- Expected impact: client can probe auth state and logout invalidates consistently
- Possible risk: secret rotation invalidates all active tokens
- Validation performed: login, refresh, browser restart, logout, and protected route denial
- Evidence: `tests/e2e/artifacts/2026-03-25_20-08-59/result.json`
- Related decision: `DEC-002-jwt-cookie-session-and-dual-guard.md`
- Related test: Selenium session lifecycle

## CHG-008

- Timestamp: 2026-03-25T19:08:00-04:00
- File: `app/api/health/route.ts`
- Function or block: storage writability probe
- Previous state: no dedicated health endpoint for runtime storage checks
- Change applied: added health route that ensures `STORAGE_BASE` exists and is readable/writable
- Reason: Docker and Nginx health checks need a real signal tied to application storage
- Expected impact: compose can fail fast when storage is not writable
- Possible risk: health route only checks storage, not application feature depth
- Validation performed: local and Docker health responses returned expected storage roots
- Evidence: Docker and local `/api/health` responses recorded in `project-memory/evidence/test-runs-index.md`
- Related decision: `DEC-003-standalone-data-root-and-docker-volume.md`
- Related test: health probes

## CHG-009

- Timestamp: 2026-03-25T19:12:00-04:00
- File: `scripts/start-standalone.mjs`
- Function or block: standalone launcher
- Previous state: `npm run start` could boot `.next/standalone/server.js` without syncing `public`, `.next/static`, or the correct data root
- Change applied: added preflight sync for runtime assets and enforced repo `APP_DATA_DIR` fallback
- Reason: make local production behavior match Docker and Termux expectations
- Expected impact: standalone startup works with correct assets and persistent data
- Possible risk: stale build output still requires a fresh `npm run build`
- Validation performed: local standalone startup and `/api/health` check
- Evidence: `project-memory/evidence/test-runs-index.md`
- Related decision: `DEC-003-standalone-data-root-and-docker-volume.md`
- Related test: local standalone health probe

## CHG-010

- Timestamp: 2026-03-25T19:15:00-04:00
- File: `package.json`
- Function or block: scripts
- Previous state: no repo-aware standalone start, no canonical E2E commands, lint target incomplete
- Change applied: rewired `start`, added `start:next`, `e2e:admin`, `e2e:smoke`, and Docker convenience scripts
- Reason: align commands with the validated workflow
- Expected impact: operators can reproduce the audited flow with stable commands
- Possible risk: environments missing Python or Docker cannot run every helper script
- Validation performed: `npm run lint`, `npm run build`, `npm run start`, Selenium commands, Docker commands
- Evidence: `project-memory/evidence/test-runs-index.md`
- Related decision: `DEC-003-standalone-data-root-and-docker-volume.md`
- Related test: lint, build, Docker, Selenium

## CHG-011

- Timestamp: 2026-03-25T19:20:00-04:00
- Files: `Dockerfile`, `.dockerignore`
- Function or block: multi-stage build and build context pruning
- Previous state: invalid Alpine packages broke builds and context hygiene was poor
- Change applied: simplified the multi-stage image, removed invalid packages, copied standalone/public/data/static correctly, and added `.dockerignore`
- Reason: produce a buildable, production-style container image
- Expected impact: Docker build succeeds and runtime has the files it needs
- Possible risk: image still depends on host-mounted `data` for persistence in production compose
- Validation performed: `docker compose up -d --build` succeeded and services became healthy
- Evidence: `project-memory/evidence/test-runs-index.md`
- Related decision: `DEC-003-standalone-data-root-and-docker-volume.md`
- Related test: Docker stack validation

## CHG-012

- Timestamp: 2026-03-25T19:24:00-04:00
- Files: `docker-compose.yml`, `docker-compose.dev.yml`, `infra/nginx/nginx.conf`
- Function or block: service topology, health checks, reverse proxy, volume contract
- Previous state: compose and Nginx assumptions were inconsistent with the real web port and writable storage needs
- Change applied: set `APP_DATA_DIR=/app/data`, bound `./data:/app/data`, aligned Nginx with `web:3000`, and added working health checks
- Reason: make development and production-style stacks reproducible
- Expected impact: Nginx proxies to the real app service and uploads survive container recreation
- Possible risk: host filesystem permissions must still permit container writes
- Validation performed: `docker compose ps`, `http://127.0.0.1:8080/api/health`, login/proxy smoke through Nginx
- Evidence: `project-memory/evidence/test-runs-index.md`
- Related decision: `DEC-003-standalone-data-root-and-docker-volume.md`
- Related test: Docker proxy smoke and health checks

## CHG-013

- Timestamp: 2026-03-25T19:28:00-04:00
- Files: `scripts/start_app.sh`, `scripts/deploy_termux.sh`, `scripts/bootstrap_remote.sh`, `.env.example`
- Function or block: deployment helpers and environment contract
- Previous state: scripts did not consistently export `APP_DATA_DIR` and env documentation was incomplete
- Change applied: normalized data-root export, tightened data permission handling, and documented required vars
- Reason: keep non-Docker fallbacks aligned with the same storage contract
- Expected impact: Termux and remote bootstrap behave closer to the Dockerized runtime model
- Possible risk: scripts still assume operator-controlled shell environments
- Validation performed: scripts reviewed against the final runtime contract and documented in project memory
- Evidence: `project-memory/08-docker-architecture.md`, `project-memory/09-android-deployment-strategy.md`
- Related decision: `DEC-003-standalone-data-root-and-docker-volume.md`
- Related test: configuration review tied to validated runtime outputs

## CHG-014

- Timestamp: 2026-03-25T19:32:00-04:00
- File: `data/cms.json`
- Function or block: active CMS seed
- Previous state: broken homepage content, missing sections, nonexistent image references
- Change applied: restored a sane homepage baseline and removed broken local references
- Reason: recover the public site and produce a stable base for admin verification
- Expected impact: public homepage renders complete content immediately after build/start
- Possible risk: previous ad hoc content changes were overwritten by the repair baseline
- Validation performed: public homepage render and Selenium public checks
- Evidence: `tests/e2e/artifacts/2026-03-25_20-08-59/08_public_render_initial.png`
- Related decision: `DEC-001-file-backed-storage-and-managed-images.md`
- Related test: public smoke and admin image/session flow

## CHG-015

- Timestamp: 2026-03-25T19:40:00-04:00
- Files: `tests/e2e/profile_runtime.py`, `tests/e2e/profile_manager.py`, `tests/e2e/requirements.txt`
- Function or block: persistent profile preparation and Python dependency pin
- Previous state: Selenium workflow was incomplete for the required persistent cloned-profile model
- Change applied: added clone preparation, lock handling, ignored-file filtering, friendly lock messaging, and pinned `selenium==4.41.0`
- Reason: satisfy the repository testing rules and make the suite reproducible
- Expected impact: test sessions persist without touching the live Chrome profile directly
- Possible risk: first-time clone still requires Chrome to be closed if the source profile is locked
- Validation performed: `python tests/e2e/profile_manager.py --profile Default`
- Evidence: JSON output recorded in `project-memory/evidence/test-runs-index.md`
- Related decision: `DEC-004-android-remote-docker-first.md`
- Related test: profile preparation run

## CHG-016

- Timestamp: 2026-03-25T19:50:00-04:00
- Files: `tests/e2e/admin_image_session_flow.py`, `tests/e2e/admin_test.py`, `tests/e2e/public_smoke.py`, `tests/e2e/README.md`
- Function or block: canonical E2E flow, wrapper entrypoint, smoke path, test documentation
- Previous state: E2E coverage did not prove the full required workflow
- Change applied: built a timestamped artifact workflow with explicit waits, screenshots, browser logs, report files, browser restart persistence, public render assertions, image replacement checks, and cleanup
- Reason: produce evidence-backed validation instead of assertions without artifacts
- Expected impact: the repo now contains a reproducible proof of admin auth and image persistence
- Possible risk: UI selector changes will require coordinated test updates
- Validation performed: final successful run at `tests/e2e/artifacts/2026-03-25_20-08-59/`
- Evidence: `tests/e2e/artifacts/2026-03-25_20-08-59/result.json`
- Related decision: `DEC-001-file-backed-storage-and-managed-images.md`, `DEC-002-jwt-cookie-session-and-dual-guard.md`
- Related test: full admin image/session Selenium suite

## CHG-017

- Timestamp: 2026-03-25T19:58:00-04:00
- Files: `app/layout.tsx`, `app/about/page.tsx`, `app/contact/page.tsx`, `app/journal/page.tsx`, `lib/context-reader.ts`, `README.md`
- Function or block: layout semantics, lint fixes, docs refresh
- Previous state: lint-blocking quote issues and stale repository documentation
- Change applied: fixed escaped text issues, aligned layout semantics, adjusted context typing, and rewrote README to match the real runtime
- Reason: keep the public site and docs consistent with the repaired platform
- Expected impact: clean lint pass and accurate operator instructions
- Possible risk: README instructions must stay synced with future architectural changes
- Validation performed: `npm run lint`
- Evidence: `project-memory/evidence/test-runs-index.md`
- Related decision: `DEC-003-standalone-data-root-and-docker-volume.md`
- Related test: lint

## CHG-018

- Timestamp: 2026-03-25T21:00:00-04:00
- Files: `lib/storage.ts`, `app/api/health/route.ts`
- Function or block: dynamic image processor resolution, passthrough validation, health payload
- Previous state: image uploads depended unconditionally on `sharp`, and health output did not reveal the active image-processing mode
- Change applied: replaced the static `sharp` import with runtime detection, added signature-based passthrough storage for Android when `sharp` is unavailable, and exposed `imageProcessing` in `/api/health`
- Reason: keep uploads and startup working on `android-arm64` where `sharp` cannot load
- Expected impact: Android Termux can serve the app and accept validated image uploads without native `sharp`
- Possible risk: passthrough mode skips resizing and optimization, so uploaded files keep their original dimensions
- Validation performed: local standalone health probe returned `imageProcessing=sharp`; remote Android health probe returned `imageProcessing=passthrough`; remote auth+upload API flow passed
- Evidence: `project-memory/evidence/android-deployment-2026-03-25.md`
- Related decision: `DEC-001-file-backed-storage-and-managed-images.md`
- Related test: Android remote health probe and API upload validation

## CHG-019

- Timestamp: 2026-03-25T21:05:00-04:00
- Files: `next.config.ts`, `package.json`
- Function or block: Android build configuration
- Previous state: the default build path used Turbopack, which failed on the Android Termux host because only WASM bindings were available
- Change applied: Android builds now disable image optimization in `next.config.ts`, and `package.json` gained `build:android` mapped to `next build --webpack`
- Reason: make the repo buildable on the actual Android host that serves the site
- Expected impact: Android deployments compile successfully and avoid runtime image optimizer dependency on native `sharp`
- Possible risk: Android builds lose Turbopack build-speed benefits and global image optimization
- Validation performed: remote `npm run build:android` passed on `android/arm64`
- Evidence: `project-memory/evidence/android-deployment-2026-03-25.md`
- Related decision: `DEC-004-android-remote-docker-first.md`
- Related test: Android remote build validation

## CHG-020

- Timestamp: 2026-03-25T21:19:00-04:00
- Files: `scripts/bootstrap_remote.sh`, `scripts/install_termux_service.sh`, `scripts/termux-service-run.sh`, `scripts/termux-boot-start-services.sh`
- Function or block: Android service supervision and boot preparation
- Previous state: Android fallback deployment started the app ad hoc without supervised restart behavior or a boot-script contract
- Change applied: added a Termux installer for `termux-services`, a `runit` service definition that executes the standalone server directly, a boot script that starts services and reacquires the wake lock, and Android-aware bootstrap logic
- Reason: keep the service alive under Termux and prepare automatic startup after device reboot
- Expected impact: the Android host now respawns the web process after crashes or manual kills, and it is ready for reboot startup once the matching `Termux:Boot` add-on is installed
- Possible risk: Android battery optimization can still kill Termux because the shell user lacks permission to whitelist the app programmatically
- Validation performed: remote `runsvdir` and `runsv` were installed and running, the service restarted with a new PID after a forced kill, and remote/local health probes stayed green
- Evidence: `project-memory/evidence/android-deployment-2026-03-25.md`
- Related decision: `DEC-004-android-remote-docker-first.md`
- Related test: Android remote respawn validation

## CHG-021

- Timestamp: 2026-03-25T22:28:00-04:00
- Files: `scripts/install_termux_service.sh`, `scripts/termux-boot-start-services.sh`, `scripts/termux-cloudflared-run.sh`
- Function or block: Cloudflare tunnel supervision and boot-script de-duplication
- Previous state: `cloudflared` depended on a legacy `start-galantes.sh` boot script outside `runit`, and the tunnel was down after the Android service refactor
- Change applied: added a dedicated `cloudflared` Termux service runner, updated the installer to register it under `termux-services`, updated the boot script to bring it up, and disabled the legacy `start-galantes.sh` boot script
- Reason: restore the public tunnel and prevent duplicate app/tunnel processes once `Termux:Boot` is activated
- Expected impact: the Cloudflare tunnel now survives process crashes under `runit` and the boot path is consistent with the supervised app service
- Possible risk: if `CF_TUNNEL_TOKEN` changes and `.env` is not updated, the `cloudflared` service will fail cleanly at startup
- Validation performed: `cloudflared` service reached `run`, `cloudflared.log` showed four registered QUIC connections and ingress to `http://127.0.0.1:3000`, and `https://galantesjewelry.com` returned HTTP `200`
- Evidence: `project-memory/evidence/android-cloudflare-recovery-2026-03-25.md`
- Related decision: `DEC-004-android-remote-docker-first.md`
- Related test: Android remote tunnel recovery

## CHG-022

- Timestamp: 2026-03-29T18:45:00-04:00
- File: `.github/workflows/deploy-android-termux.yml`
- Function or block: workflow deploy path, bundle creation, SSH configuration, secret wiring, remote execution
- Previous state: the repository had no durable CI path to deploy the Android Termux host, and early workflow attempts failed on bundle creation, secret handling, and SSH configuration
- Change applied: added and hardened the GitHub Actions deploy workflow so it packages from `RUNNER_TEMP`, declares `environment: Production`, targets `ssh.galantesjewelry.com`, accepts raw or base64 SSH key secrets, uploads the bundle/env/script trio, and validates public health
- Reason: make Android deploys reproducible from GitHub-hosted runners instead of relying on the workstation
- Expected impact: pushes or manual workflow dispatches can update the Android host through the Cloudflare SSH hostname
- Possible risk: CI still depends on Cloudflare tunnel health and correctly populated environment secrets
- Validation performed: the repaired workflow advanced past every earlier failure mode, the public site remained healthy, and the domain SSH path passed
- Evidence: `project-memory/evidence/github-actions-android-deploy-2026-03-29.md`
- Related decision: `DEC-005-github-actions-termux-deploy-over-cloudflare-ssh.md`
- Related test: GitHub Actions troubleshooting session, SSH domain validation, public health probe

## CHG-023

- Timestamp: 2026-03-29T18:52:00-04:00
- Files: `scripts/install_termux_service.sh`, `scripts/termux-boot-start-services.sh`
- Function or block: Android boot contract, package installation, supervised `sshd` startup
- Previous state: the Android host used an orphan `sshd` process, and the installer messaging still reflected the older assumption that a separate `Termux:Boot` add-on was always required
- Change applied: ensured `openssh` and `cloudflared` installation when required, removed the `sshd/down` guard, started `sshd` from the boot script, and detected the Google Play Termux build so integrated boot support is documented correctly
- Reason: keep the Android host reachable after reboot and align the repo with the validated Termux distribution
- Expected impact: the host now restarts `sshd`, the app, and the tunnel under `runit`, and future operators are less likely to chase the wrong Termux add-on path
- Possible risk: Android battery optimization remains outside shell control and can still kill background services
- Validation performed: `sv status` reported `run` for `sshd`, `galantesjewelry`, and `cloudflared`, and `ssh.galantesjewelry.com` authenticated successfully
- Evidence: `project-memory/evidence/github-actions-android-deploy-2026-03-29.md`
- Related decision: `DEC-005-github-actions-termux-deploy-over-cloudflare-ssh.md`
- Related test: SSH domain validation and remote service-status probes

## CHG-024

- Timestamp: 2026-03-29T19:12:00-04:00
- File: `scripts/deploy_termux_bundle.sh`
- Function or block: remote deploy extract/build/restart/health sequence
- Previous state: the remote deploy helper could leave the old app process alive or fail immediately after restart because it waited a fixed two seconds and probed health only once
- Change applied: restarted `galantesjewelry` under `sv` explicitly and replaced the single health probe with a retry loop against `http://127.0.0.1:3000/api/health`
- Reason: make deploy completion deterministic on the slower Android host
- Expected impact: successful builds are less likely to be marked failed just because the service needs more than two seconds to become healthy
- Possible risk: a real startup failure now takes longer to surface because the script waits through the retry budget
- Validation performed: the Android host returned `status=ok` after restart and the public health endpoint remained `200`
- Evidence: `project-memory/evidence/github-actions-android-deploy-2026-03-29.md`
- Related decision: `DEC-005-github-actions-termux-deploy-over-cloudflare-ssh.md`
- Related test: remote restart validation and public health probe

## CHG-025

- Timestamp: 2026-03-29T19:18:00-04:00
- File: `.gitignore`
- Function or block: runtime artifact exclusions
- Previous state: temporary deploy bundles, Selenium artifacts, runtime Chrome-profile clones, and local blob data could be staged accidentally
- Change applied: ignored temporary deploy directories, tarballs, logs, runtime test artifacts, cloned Chrome profiles, and `data/blobs`
- Reason: keep commits focused on durable source changes and avoid committing local operational debris
- Expected impact: future deploy or test sessions should generate less git noise and lower the chance of pushing artifacts by mistake
- Possible risk: operators may forget that runtime evidence now lives outside version control unless it is intentionally indexed in project memory
- Validation performed: `git status` dropped the runtime noise down to actual source changes plus the intentionally modified `data/cms.json`
- Evidence: workstation git status checks during the 2026-03-29 session
- Related decision: `DEC-005-github-actions-termux-deploy-over-cloudflare-ssh.md`
- Related test: git hygiene checks during deploy prep

## CHG-026

- Timestamp: 2026-03-29T22:17:55-04:00
- Files: `project-memory/15-github-actions-termux-runbook.md`, `project-memory/decisions/DEC-005-github-actions-termux-deploy-over-cloudflare-ssh.md`, `project-memory/evidence/github-actions-android-deploy-2026-03-29.md`, `project-memory/conversations/2026-03-29_agent-session_004.md`, `project-memory/evidence/test-runs-index.md`, `project-memory/evidence/screenshots-index.md`, `project-memory/09-android-deployment-strategy.md`, `project-memory/14-next-steps.md`, `context/operations/deployment_notes.md`
- Function or block: durable troubleshooting memory for GitHub Actions, Cloudflare SSH, and the Play Store Termux boot model
- Previous state: the 2026-03-29 deploy-recovery session existed only in live terminal context and would have to be rediscovered during the next incident
- Change applied: added a runbook, decision record, evidence file, conversation record, cross-linked test entries, screenshot index update, architecture addendum, and deployment-note updates
- Reason: reduce mean time to recover the next time CI, SSH, or Android boot behavior regresses
- Expected impact: future agents can jump directly to the documented failure modes and verified fixes instead of replaying the full investigation
- Possible risk: the memory can become stale if future workflow or host changes are not documented with the same rigor
- Validation performed: cross-references now point to the current evidence set, and the production domain plus SSH tunnel were still healthy while documenting the session
- Evidence: `project-memory/evidence/github-actions-android-deploy-2026-03-29.md`
- Related decision: `DEC-005-github-actions-termux-deploy-over-cloudflare-ssh.md`
- Related test: SSH domain validation, public health probe, Selenium smoke
