# GitHub Actions Android Deploy Evidence

## Metadata

- Timestamp: 2026-03-29T22:17:55-04:00
- Host: `u0_a382@ssh.galantesjewelry.com:8022`
- Secondary LAN host observed during the session: `u0_a382@10.1.10.119:8022`
- Environment: Termux on Android, Google Play Termux build, Cloudflare Tunnel fronting the public site and dedicated SSH hostname
- Workflow: `.github/workflows/deploy-android-termux.yml`

## Commands

- updated `C:\Users\yoeli\.ssh\config` with `galates` and `galates-domain`
- generated dedicated ed25519 keys for workstation access and GitHub Actions deploys
- uploaded the new service and deploy scripts to the Android host
- added deploy public keys to `~/.ssh/authorized_keys`
- moved `sshd` from an orphan process to supervised `runit`
- verified SSH through `ssh.galantesjewelry.com`
- built and uploaded source bundles to the Android host
- ran `scripts/deploy_termux_bundle.sh` remotely
- iteratively corrected the workflow until GitHub Actions could use Production environment secrets and a stable bundle path
- ran post-deploy health probes and Selenium smoke validation

## Environment

- Canonical SSH hostname: `ssh.galantesjewelry.com`
- Canonical SSH user: `u0_a382`
- GitHub Actions environment: `Production`
- Canonical app directory: `/data/data/com.termux/files/home/galantesjewelry`
- Canonical service port: `3000`
- Termux service set:
  - `sshd`
  - `galantesjewelry`
  - `cloudflared`

## Results

- SSH over Cloudflare Tunnel passed end-to-end:
  - `ssh -o StrictHostKeyChecking=accept-new galates-domain "echo ssh-domain-ok"` returned `ssh-domain-ok`
  - `ssh -o BatchMode=yes galates-domain "hostname; whoami; echo final-check-ok"` returned `localhost`, `u0_a382`, and `final-check-ok`
- The Android host boot contract was prepared under the Play build:
  - `scripts/install_termux_service.sh` detected `installer=com.android.vending`
  - `~/.termux/boot/00-start-services` starts `sshd`, `galantesjewelry`, and `cloudflared`
- The public site remained healthy:
  - `https://galantesjewelry.com/api/health` returned HTTP `200`
- The Android runtime remained healthy over SSH after deploy:
  - `sv status` returned `run` for `galantesjewelry`, `cloudflared`, and `sshd`
  - local `/api/health` returned `status=ok`, `imageProcessing=passthrough`, and `writable=true`
- Public Selenium smoke passed against the production domain

## Evidence

- Workflow-hardening commits:
  - `8a1b301` initial Android deploy pipeline and storefront updates
  - `7059dde` secrets-safe workflow guard
  - `df88151` bundle creation moved outside repo tree
  - `a2c10d8` hardcoded canonical SSH target
  - `f73dec7` base64 SSH key fallback
  - `3e40df9` `environment: Production`
  - `c919abe` post-restart health retry
- Failure evidence retained:
  - `tests/e2e/artifacts/2026-03-29_19-08-09/report.md`
  - `tests/e2e/artifacts/2026-03-29_19-08-09/99_failure.png`
- Related runbook:
  - `project-memory/15-github-actions-termux-runbook.md`

## Notes

- The fastest control path is now the SSH tunnel hostname, not the LAN IP.
- The Play Store Termux build invalidated the earlier assumption that this host required the separate `Termux:Boot` add-on.
- Cloudflare Access hardening remains recommended after the successful validation phase.
