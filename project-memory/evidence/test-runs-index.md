# Test Runs Index

## 2026-03-25T19:05:00-04:00

- Command: `npm run lint`
- Result: pass
- Notes: 1 warning remains in `components/admin/ImageUploader.tsx` for the intentional plain `<img>` preview
- Evidence: repository validation during final repair session

## 2026-03-25T19:12:00-04:00

- Command: `npm run build`
- Result: pass
- Notes: standalone build generated successfully after runtime-path and Docker fixes
- Evidence: repository validation during final repair session

## 2026-03-25T19:14:00-04:00

- Command: local health probe against `http://127.0.0.1:3000/api/health`
- Result: pass
- Notes: returned `status=ok`, `storageBase=C:\\Users\\yoeli\\Documents\\Galantesjewerly\\data\\blobs`, `writable=true`
- Evidence: local standalone validation

## 2026-03-25T19:20:00-04:00

- Command: stale-read verification before and after `lib/db.ts` cache fix
- Result: pass
- Notes:
  - before fix the homepage HTML did not contain the freshly created featured item
  - after fix the same probe returned the created item id, title, and image
- Evidence: debugging notes summarized in `project-memory/04-root-cause.md`

## 2026-03-25T19:30:00-04:00

- Command: `docker compose up -d --build`
- Result: pass
- Notes: previous Dockerfile package failure removed; compose stack built and started
- Evidence: local Docker validation

## 2026-03-25T19:33:00-04:00

- Command: `docker compose ps`
- Result: pass
- Notes: `galantes_web` and `galantes_nginx` reached healthy state
- Evidence: local Docker validation

## 2026-03-25T19:34:00-04:00

- Command: Docker health probe against `http://127.0.0.1:8080/api/health`
- Result: pass
- Notes: returned `status=ok`, `storageBase=/app/data/blobs`, `writable=true`
- Evidence: local Docker validation

## 2026-03-25T19:36:00-04:00

- Command: Docker proxy smoke through Nginx
- Result: pass
- Notes:
  - unauthorized dashboard redirected to login
  - login succeeded
  - featured item CRUD via admin API succeeded
  - managed image fetch succeeded
  - managed image 404 after delete succeeded
- Evidence: local proxy smoke validation

## 2026-03-25T19:57:23-04:00

- Command: `python tests/e2e/admin_image_session_flow.py`
- Result: fail
- Artifact directory: `tests/e2e/artifacts/2026-03-25_19-57-23/`
- Notes: early browser instability resulted in `TimeoutException` during login flow

## 2026-03-25T19:59:46-04:00

- Command: `python tests/e2e/admin_image_session_flow.py`
- Result: fail
- Artifact directory: `tests/e2e/artifacts/2026-03-25_19-59-46/`
- Notes: timed out while proving public render of the saved featured item before the ordering helper was introduced

## 2026-03-25T20:02:13-04:00

- Command: `python tests/e2e/admin_image_session_flow.py`
- Result: fail
- Artifact directory: `tests/e2e/artifacts/2026-03-25_20-02-13/`
- Notes: `NoSuchWindowException` showed the browser session was closing unexpectedly, which led to driver retry hardening

## 2026-03-25T20:04:09-04:00

- Command: `python tests/e2e/admin_image_session_flow.py`
- Result: fail
- Artifact directory: `tests/e2e/artifacts/2026-03-25_20-04-09/`
- Notes: same public-render timeout reproduced once more, confirming the need to force temporary featured-item priority during the public assertion stage

## 2026-03-25T20:08:59-04:00

- Command: `python tests/e2e/admin_image_session_flow.py`
- Result: pass
- Artifact directory: `tests/e2e/artifacts/2026-03-25_20-08-59/`
- Notes:
  - login passed
  - refresh persistence passed
  - browser restart persistence passed
  - create, upload, save, reload, public render, edit, replace, cleanup, logout, and post-logout denial all passed

## 2026-03-25T20:11:00-04:00

- Command: `python tests/e2e/public_smoke.py`
- Result: pass
- Notes: public site and auth entry route remained reachable after the final fixes

## 2026-03-25T20:12:00-04:00

- Command: `python tests/e2e/profile_manager.py --profile Default`
- Result: pass
- Notes: confirmed persistent cloned profile path and source profile path

## 2026-03-25T20:13:00-04:00

- Command: `python -m py_compile tests/e2e/admin_image_session_flow.py tests/e2e/profile_manager.py tests/e2e/profile_runtime.py tests/e2e/public_smoke.py tests/e2e/admin_test.py`
- Result: pass
- Notes: Python syntax verified for the canonical Selenium assets

## 2026-03-25T21:03:00-04:00

- Command: `npm run build`
- Result: pass
- Notes: local standalone build still passed after the Android fallback changes
- Evidence: `project-memory/evidence/android-deployment-2026-03-25.md`

## 2026-03-25T21:05:00-04:00

- Command: local health probe against `http://127.0.0.1:3000/api/health`
- Result: pass
- Notes: returned `imageProcessing=sharp`, confirming Linux/Windows flows still use native processing
- Evidence: `project-memory/evidence/android-deployment-2026-03-25.md`

## 2026-03-25T21:19:00-04:00

- Command: `npm run build:android` on `u0_a325@192.168.12.193`
- Result: pass
- Notes: Android build succeeded only with Webpack, not Turbopack
- Evidence: `project-memory/evidence/android-deployment-2026-03-25.md`

## 2026-03-25T21:20:00-04:00

- Command: Android health probe against `http://127.0.0.1:3000/api/health`
- Result: pass
- Notes: returned `imageProcessing=passthrough` with writable persistent storage
- Evidence: `project-memory/evidence/android-deployment-2026-03-25.md`

## 2026-03-25T21:22:00-04:00

- Command: `runit` respawn validation for `galantesjewelry` on Android
- Result: pass
- Notes: the supervised service restarted from PID `30552` to PID `30670` after a forced kill
- Evidence: `project-memory/evidence/android-deployment-2026-03-25.md`

## 2026-03-25T21:23:00-04:00

- Command: workstation health probe against `http://192.168.12.193:3000/api/health`
- Result: pass
- Notes: remote Android service was reachable over the LAN
- Evidence: `project-memory/evidence/android-deployment-2026-03-25.md`

## 2026-03-25T21:24:00-04:00

- Command: `python tests/e2e/public_smoke.py` against `http://192.168.12.193:3000`
- Result: pass
- Notes: public home and admin login page were stable against the live Android host
- Evidence: `project-memory/evidence/android-deployment-2026-03-25.md`

## 2026-03-25T21:25:00-04:00

- Command: `python tests/e2e/admin_image_session_flow.py` against `http://192.168.12.193:3000`
- Result: fail
- Artifact directory: `tests/e2e/artifacts/2026-03-25_21-25-01/`
- Notes: Chrome headless hit `ElementClickInterceptedException` on the login submit button before reaching backend assertions
- Evidence: `tests/e2e/artifacts/2026-03-25_21-25-01/`

## 2026-03-25T21:26:00-04:00

- Command: workstation API validation against `http://192.168.12.193:3000`
- Result: pass
- Notes:
  - login `200`
  - session probe `200`
  - upload `200`
  - managed image fetch `200`
  - logout `200`
  - post-logout denial `401`
- Evidence: `project-memory/evidence/android-deployment-2026-03-25.md`

## 2026-03-25T22:28:00-04:00

- Command: `sh scripts/install_termux_service.sh` on `u0_a325@192.168.12.193` after adding the `cloudflared` service
- Result: pass
- Notes: `cloudflared` was registered under `termux-services` and the legacy boot script was disabled
- Evidence: `project-memory/evidence/android-cloudflare-recovery-2026-03-25.md`

## 2026-03-25T22:29:00-04:00

- Command: `sv status /data/data/com.termux/files/usr/var/service/cloudflared`
- Result: pass
- Notes: the tunnel service reached `run`
- Evidence: `project-memory/evidence/android-cloudflare-recovery-2026-03-25.md`

## 2026-03-25T22:29:00-04:00

- Command: `tail -n 120 ~/cloudflared.log`
- Result: pass
- Notes: the tunnel registered four QUIC connections and updated ingress to `http://127.0.0.1:3000`
- Evidence: `project-memory/evidence/android-cloudflare-recovery-2026-03-25.md`

## 2026-03-25T22:29:00-04:00

- Command: workstation request to `https://galantesjewelry.com`
- Result: pass
- Notes: returned HTTP `200` after the supervised tunnel came back up
- Evidence: `project-memory/evidence/android-cloudflare-recovery-2026-03-25.md`
