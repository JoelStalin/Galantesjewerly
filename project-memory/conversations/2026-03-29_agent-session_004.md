# Conversation Record

## Objective

- Session id: `2026-03-29_agent-session_004`
- Date: 2026-03-29
- Operator: Codex with the repository owner
- Mission: enable the integrated Termux boot path, expose stable SSH control through the project domain, make GitHub Actions deploy to the Android host automatically, and document every deploy failure and recovery step

## Prompt Received

The user asked to use the integrated boot flow, configure Android SSH access through `galantesjewelry.com`, prepare GitHub Actions for automatic deployment, and then preserve the full troubleshooting context in well-documented project memory.

## Operational Interpretation

- The Android host had to remain the active production runtime
- The public storefront could not be broken while adding SSH control and CI deploys
- The repository had to keep the troubleshooting state durable so future deploy failures could be fixed quickly
- Secrets could not be committed; the workflow needed to consume them from GitHub Actions

## Audit Performed

- Inspected the repository deployment scripts, Selenium rules, architecture notes, and project-memory rules
- Audited the Android host over SSH, including `sshd`, `termux-services`, Cloudflare Tunnel, and `.env`
- Verified the Cloudflare SSH hostname design against official docs
- Reproduced and inspected GitHub Actions failures reported by the user
- Ran health checks and Selenium smoke validation against the live production domain

## Decisions

- Decision id: `DEC-005`
- Summary: GitHub Actions deploys must target `ssh.galantesjewelry.com` over Cloudflare SSH, use `environment: Production`, and rely on the Play Store Termux integrated boot path
- Why it was chosen: GitHub-hosted runners cannot reach the Android LAN IP, and the validated Termux distribution on this host is the Play build

## Actions Executed

- Code changes:
  - added and hardened `.github/workflows/deploy-android-termux.yml`
  - added `scripts/deploy_termux_bundle.sh`
  - updated `scripts/install_termux_service.sh` and `scripts/termux-boot-start-services.sh`
  - updated `.gitignore` to exclude runtime artifacts
- Config changes:
  - added workstation SSH entries for `galates` and `galates-domain`
  - created dedicated deploy and workstation SSH keys
  - registered deploy keys in the Android host `authorized_keys`
- Infra changes:
  - switched `sshd` to supervised `runit`
  - validated `ssh.galantesjewelry.com`
  - deployed the app bundle directly to the Android host while the workflow was being repaired

## Errors Found

- Error: `tar: .: file changed as we read it`
  - Trigger: the workflow created the deploy tarball inside the repo tree it was archiving
  - Evidence: GitHub Actions `Create deploy bundle` failure during the 2026-03-29 session
- Error: workflow rejection caused by direct `secrets.*` use in `if:`
  - Trigger: the original workflow compared a secret directly in the step condition
  - Evidence: first GitHub Actions run failed before remote work started
- Error: `/home/runner/.ssh/config line ... no argument after keyword "hostname"` and `"user"`
  - Trigger: host/user values were empty in the runner
  - Evidence: GitHub Actions `Upload bundle and env` failure
- Error: `ANDROID_SSH_PRIVATE_KEY secret is missing`
  - Trigger: secrets existed under Environment `Production`, but the job had not declared `environment: Production`
  - Evidence: GitHub Actions `Configure SSH` failure with empty secret values
- Error: deploys failed after successful Android builds
  - Trigger: `scripts/deploy_termux_bundle.sh` restarted the service and probed health only once after `sleep 2`
  - Evidence: remote app build logs followed by post-restart deploy instability

## Corrections Applied

- Fix: moved deploy bundle creation to `$RUNNER_TEMP`
  - Files: `.github/workflows/deploy-android-termux.yml`
  - Validation: local tar packaging reproduced cleanly and the workflow moved past bundle creation
- Fix: moved Cloudflare toggle handling from `secrets.*` to `env`
  - Files: `.github/workflows/deploy-android-termux.yml`
  - Validation: workflow syntax became acceptable to GitHub Actions
- Fix: hardcoded the canonical SSH host/user in the workflow
  - Files: `.github/workflows/deploy-android-termux.yml`
  - Validation: runner no longer wrote an invalid `~/.ssh/config`
- Fix: declared `environment: Production`
  - Files: `.github/workflows/deploy-android-termux.yml`
  - Validation: Environment secrets became eligible for injection
- Fix: added support for `ANDROID_SSH_PRIVATE_KEY_B64`
  - Files: `.github/workflows/deploy-android-termux.yml`
  - Validation: the workflow gained a single-line fallback path for SSH key injection
- Fix: restarted `galantesjewelry` explicitly and waited for real health
  - Files: `scripts/deploy_termux_bundle.sh`
  - Validation: service reached `run` and local `/api/health` returned `status=ok`
- Fix: supervised `sshd` and updated boot scripts for the Play Store Termux build
  - Files: `scripts/install_termux_service.sh`, `scripts/termux-boot-start-services.sh`
  - Validation: `ssh.galantesjewelry.com` passed end-to-end and `sv status` showed `run`

## Validations Executed

- Command: `npm run lint`
  - Result: pass
  - Evidence path: `project-memory/evidence/test-runs-index.md`
- Command: `npm run build`
  - Result: pass
  - Evidence path: `project-memory/evidence/test-runs-index.md`
- Command: `ssh -o StrictHostKeyChecking=accept-new galates-domain "echo ssh-domain-ok"`
  - Result: pass
  - Evidence path: `project-memory/evidence/github-actions-android-deploy-2026-03-29.md`
- Command: `ssh -o BatchMode=yes galates-domain "hostname; whoami; echo final-check-ok"`
  - Result: pass
  - Evidence path: `project-memory/evidence/github-actions-android-deploy-2026-03-29.md`
- Command: `python tests/e2e/public_smoke.py` against `https://galantesjewelry.com`
  - Result: pass
  - Evidence path: `project-memory/evidence/test-runs-index.md`
- Command: `python tests/e2e/admin_image_session_flow.py` against `https://galantesjewelry.com`
  - Result: fail
  - Evidence path: `tests/e2e/artifacts/2026-03-29_19-08-09/report.md`

## Pending Items

- Open issue: add Cloudflare Access protection and service-token enforcement to `ssh.galantesjewelry.com`
  - Owner: repository owner
  - Blocking or non-blocking: non-blocking for current deploys, blocking for long-term hardening
- Open issue: disable Android battery optimization for Termux
  - Owner: device owner
  - Blocking or non-blocking: non-blocking for live service, blocking for the strongest reboot reliability
- Open issue: investigate the admin Selenium timeout waiting for the exact admin notice text
  - Owner: future engineering session
  - Blocking or non-blocking: non-blocking for deploy automation
