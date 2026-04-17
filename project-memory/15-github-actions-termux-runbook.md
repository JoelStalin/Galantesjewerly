# GitHub Actions Termux Runbook

## Status

- Date: 2026-03-29
- State: active
- Canonical deploy path: GitHub Actions `Deploy Android Termux` workflow -> `ssh.galantesjewelry.com` -> `scripts/deploy_termux_bundle.sh` on the Android host
- Canonical runtime host: `u0_a382` in Termux, reachable over Cloudflare SSH and serving the public site through the existing Cloudflare tunnel

## Scope

- Troubleshoot automated deploy failures for the Android Termux host
- Preserve the exact operational fixes discovered during the 2026-03-29 recovery session
- Document the current boot, SSH, and CI expectations so future agents do not rediscover them

## Findings and Architecture

### Current deploy architecture

1. GitHub Actions builds a source bundle in `RUNNER_TEMP`, not inside the checked-out repo tree.
2. The runner installs `openssh-client` and `cloudflared`.
3. The workflow uses `environment: Production`, so deploy secrets must live under **Environment secrets / Production**.
4. SSH targets the dedicated hostname `ssh.galantesjewelry.com`, not the LAN IP and not the apex website hostname.
5. The workflow uploads the bundle, a transient `.env`, and `scripts/deploy_termux_bundle.sh`.
6. The Android host runs `npm ci`, `npm run build:android`, `scripts/install_termux_service.sh`, restarts `galantesjewelry` under `termux-services`, and waits for `/api/health` to return `200`.
7. Public validation ends at `https://galantesjewelry.com/api/health`.

### Current boot architecture

- The validated host is the Google Play build of Termux (`installer=com.android.vending`).
- On this host generation, boot support is integrated into the main Termux app; the filesystem contract remains `~/.termux/boot/00-start-services`.
- `sshd`, `galantesjewelry`, and `cloudflared` are supervised with `runit` under `termux-services`.
- Battery optimization is still an Android OS risk and must be disabled manually for Termux.

### Fast troubleshooting map

| Symptom | Root cause confirmed in practice | Fast fix |
| --- | --- | --- |
| `tar: .: file changed as we read it` in `Create deploy bundle` | the workflow was creating the tarball inside the repo tree while tar was reading `.` | write the bundle to `$RUNNER_TEMP` and export the path through `GITHUB_ENV` |
| workflow rejected before running because of `secrets.*` in `if:` | GitHub Actions does not allow direct `secrets.*` use in that `if:` position | map the value into `env` first, then compare `env.ANDROID_SSH_USE_CLOUDFLARED` |
| `/home/runner/.ssh/config line ... no argument after keyword "hostname"` | `ANDROID_SSH_HOST` and `ANDROID_SSH_USER` were not injected | hardcode the non-secret host/user values in the workflow |
| `ANDROID_SSH_PRIVATE_KEY secret is missing` even though a secret exists | the secret lived under **Environment secrets / Production** while the job did not declare `environment: Production` | add `environment: Production` to the deploy job |
| multiline SSH key remains empty or unreliable | GitHub secret formatting is brittle for some pasted multiline keys | support `ANDROID_SSH_PRIVATE_KEY_B64` as a one-line base64 fallback |
| remote build passes but deploy still fails after service restart | the script restarted the service and probed health only once after a fixed `sleep 2` | restart with `sv restart galantesjewelry` and loop until `/api/health` succeeds or times out |
| LAN SSH to `10.1.10.119:8022` stops responding | the Android host may leave the local network path unstable while the tunnel remains healthy | prefer `ssh.galantesjewelry.com` as the operational control path |
| local `ssh galates-domain` fails on host key verification | the workstation has not accepted the new host key for the tunnel hostname yet | run once with `StrictHostKeyChecking=accept-new` |
| Play Store search does not show `Termux:Boot` | the Play build integrates boot support into the main app | keep using `~/.termux/boot/00-start-services`; do not force-install the F-Droid add-on on the Play build |

## Evidence

- `project-memory/evidence/github-actions-android-deploy-2026-03-29.md`
- `project-memory/conversations/2026-03-29_agent-session_004.md`
- `project-memory/decisions/DEC-005-github-actions-termux-deploy-over-cloudflare-ssh.md`
- `project-memory/evidence/test-runs-index.md`
- `tests/e2e/artifacts/2026-03-29_19-08-09/report.md`

## Sources

- Cloudflare SSH over Tunnel and routing docs, consulted 2026-03-29, applied to the `ssh.galantesjewelry.com -> ssh://localhost:8022` design
- Cloudflare self-hosted application and service-token docs, consulted 2026-03-29, applied to the recommended post-validation hardening path
- Termux Play Store release and app docs, consulted 2026-03-29, applied to the conclusion that boot support is integrated in the Play build
- Local operational sources: `context/operations/termux_cloudflare_architecture.md`, `context/operations/deployment_notes.md`
