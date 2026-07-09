# Operations & Deployment Notes

## Infrastructure Overview
- **Core Tech**: Next.js, Node.js (App Router, Tailwind CSS, TypeScript).
- **Environment**: Containerized (Docker Compose) or executed pure via Termux (Samsung Android) as fallback.
- **Web Server**: Nginx reverse proxy in front of the Next.js container.
- **Network / Tunneling**: Cloudflare Tunnel (`cloudflared`) published against the internal Nginx service.

## Secrets & Variables
Store secrets only in `.env` on the host:
- `CF_TUNNEL_TOKEN`
- `CF_API_TOKEN`
- `CF_ACCOUNT_ID`

Do not commit deployment secrets to the repository.

For GitHub Actions deploys:

- the workflow uses `environment: Production`
- deploy secrets therefore belong under **Environment secrets / Production**
- the canonical SSH target is `ssh.galantesjewelry.com`, not the Android LAN IP
- the Android host `.env` is shipped through the `ANDROID_APP_ENV` secret and restored on-device during deploy

## GitHub Actions Deploy Flow
1. build the source bundle in the runner temp directory
2. install `openssh-client` and `cloudflared`
3. connect to `ssh.galantesjewelry.com` as `u0_a382`
4. upload the bundle, environment file, and deploy script
5. run `scripts/deploy_termux_bundle.sh` on the Android host
6. wait for `http://127.0.0.1:3000/api/health` on-device and `https://galantesjewelry.com/api/health` publicly

## Android Boot Notes
- on the validated Google Play build of Termux, boot support is integrated into the main app
- keep using `~/.termux/boot/00-start-services`
- do not assume the separate F-Droid `Termux:Boot` add-on is the right fix on this host
- Android battery optimization must still be disabled manually for best uptime

## Fallback Plan (Non-Docker, Limited Environment)
If deployed on an Android device via Termux where Docker cannot run:
1. Keep `output: 'standalone'` and build the app as a Node.js standalone server.
2. Copy the standalone bundle together with `public`, `.next/static`, and the persistent `data` directory.
3. Start `node server.js` in Termux with `NODE_ENV=production`, `PORT=3000`, and writable `data/blobs`.
4. Run the `cloudflared` binary directly in Termux only if Docker is not part of the environment.

## Standard Container Flow
1. `web` serves the Next.js standalone server on internal port `3000`.
2. `nginx` proxies public HTTP traffic to `web` and forwards the required headers.
3. `cloudflared` publishes the Nginx service to Cloudflare without exposing the Node container directly.
