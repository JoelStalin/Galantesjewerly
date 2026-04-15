# Android Deployment Evidence

## Metadata

- Timestamp: 2026-03-25T21:30:00-04:00
- Host: `u0_a325@192.168.12.193:8022`
- Environment: Termux on Android 13, `aarch64`
- App directory: `/data/data/com.termux/files/home/galantesjewelry`

## Commands

- uploaded Android runtime patches for `lib/storage.ts`, `next.config.ts`, `app/api/health/route.ts`, `package.json`, and Termux service scripts
- ran `npm run build:android` on the device
- ran `sh scripts/install_termux_service.sh`
- started and queried `sv status /data/data/com.termux/files/usr/var/service/galantesjewelry`
- probed `http://127.0.0.1:3000/api/health` from the device
- probed `http://192.168.12.193:3000/api/health` from the workstation
- ran `python tests/e2e/public_smoke.py` against `http://192.168.12.193:3000`
- executed a cookie-authenticated API flow from the workstation: login, session probe, multipart upload, managed image fetch, logout, post-logout denial

## Environment

- Android build requirement observed in practice: `next build --webpack`
- Android runtime image mode observed in practice: `passthrough`
- Termux service manager installed: `termux-services`
- Boot script path prepared: `~/.termux/boot/00-start-services`
- Termux:Boot add-on status: not installed on device
- Device idle whitelist status: `com.termux` not whitelisted; programmatic whitelist attempt failed with `android.permission.DEVICE_POWER`

## Results

- `npm run build:android` passed on the Android host
- `/api/health` on device returned:
  - `status=ok`
  - `imageProcessing=passthrough`
  - `storageBase=/data/data/com.termux/files/home/galantesjewelry/data/blobs`
  - `writable=true`
- `runit` supervision passed:
  - old PID: `30552`
  - new PID after forced kill: `30670`
- workstation HTTP probe to `http://192.168.12.193:3000/api/health` passed
- `python tests/e2e/public_smoke.py` passed against the Android host
- authenticated API flow passed:
  - login `200`
  - session probe `200`
  - upload `200`
  - managed image fetch `200`
  - logout `200`
  - post-logout session probe `401`

## Evidence

- Remote `server.log` showed successful startup on `0.0.0.0:3000`
- `sv status /data/data/com.termux/files/usr/var/service/galantesjewelry` reported `run`
- `pm list packages` showed only `com.termux`; `com.termux.boot` was absent
- `cmd deviceidle whitelist +com.termux` failed with `SecurityException` for missing `android.permission.DEVICE_POWER`

## Notes

- The Android host is operational and self-recovers from process death under `runit`.
- Automatic start after full device reboot is fully prepared in filesystem and service configuration, but it becomes active only after the matching `Termux:Boot` add-on is installed and opened once by the device owner.
- Android battery optimization remains an OS-level kill vector until the device owner manually exempts Termux from battery restrictions.
