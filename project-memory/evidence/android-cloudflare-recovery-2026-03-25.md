# Android Cloudflare Recovery Evidence

## Metadata

- Timestamp: 2026-03-25T22:30:00-04:00
- Host: `u0_a325@192.168.12.193:8022`
- Environment: Termux on Android 13, `aarch64`

## Commands

- inspected Android processes for `cloudflared`, `node`, and `runsv`
- verified the local app health on `127.0.0.1:3000`
- inspected the legacy boot script `~/.termux/boot/start-galantes.sh`
- uploaded `scripts/termux-cloudflared-run.sh`
- reran `sh scripts/install_termux_service.sh`
- inspected `sv status /data/data/com.termux/files/usr/var/service/cloudflared`
- tailed `~/cloudflared.log`
- requested `https://galantesjewelry.com` from the workstation

## Environment

- `cloudflared` binary present: `/data/data/com.termux/files/usr/bin/cloudflared`
- `cloudflared` version: `2026.3.0`
- `CF_TUNNEL_TOKEN` present in `~/galantesjewelry/.env`
- local app health on the device remained `status=ok` at `127.0.0.1:3000`

## Results

- before the fix, no `cloudflared` process was running
- after the fix, `sv status /data/data/com.termux/files/usr/var/service/cloudflared` returned `run`
- `~/cloudflared.log` recorded:
  - tunnel start for `08d437c9-56ad-4910-80f9-33cca283d727`
  - four registered QUIC connections
  - ingress update pointing `galantesjewelry.com`, `www.galantesjewelry.com`, and `admin.galantesjewelry.com` to `http://127.0.0.1:3000`
- workstation request to `https://galantesjewelry.com` returned HTTP `200`
- `~/.termux/boot/start-galantes.sh` was renamed to `start-galantes.sh.disabled`

## Evidence

- `cloudflared.log` showed:
  - `Registered tunnel connection ... location=mia05 protocol=quic`
  - `Registered tunnel connection ... location=mia01 protocol=quic`
  - `Updated to new configuration ... service\":\"http://127.0.0.1:3000\"`
- the supervised process list included:
  - `runsv ... cloudflared`
  - `cloudflared ... tunnel run --token ...`

## Notes

- The public tunnel failure came from `cloudflared` not running, not from the web service itself.
- The new supervised tunnel service matches the existing documented architecture of Cloudflare Tunnel routing to `127.0.0.1:3000`.
- Automatic start after full device reboot still depends on `Termux:Boot`, exactly like the app service.
