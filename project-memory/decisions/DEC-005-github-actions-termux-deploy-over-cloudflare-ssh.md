# DEC-005 GitHub Actions Termux Deploy Over Cloudflare SSH

## ID

- Decision: DEC-005
- Status: accepted
- Date: 2026-03-29

## Context

- Problem: the Android-hosted Termux runtime needed a repeatable deployment path from GitHub-hosted runners, plus a stable remote-control path after boot and network changes
- Constraints:
  - GitHub-hosted runners cannot reach the private LAN IP of the Android device
  - the public storefront already occupies `galantesjewelry.com` and must not be repurposed for SSH
  - the validated host uses the Google Play distribution of Termux, not the F-Droid stack
  - secrets were stored in the `Production` environment, so the job had to opt into that environment explicitly
- Alternatives considered:
  - deploy from the workstation only
  - use the LAN IP `10.1.10.119` directly from GitHub Actions
  - require the standalone `Termux:Boot` add-on even on the Play build

## Decision

Use a GitHub Actions workflow that deploys to the Android host through the dedicated Cloudflare SSH hostname `ssh.galantesjewelry.com`, declares `environment: Production` so environment secrets are injected, and executes the remote deployment through `scripts/deploy_termux_bundle.sh`. Treat the Google Play Termux build as the authoritative boot model for this host, with `~/.termux/boot/00-start-services` and `termux-services`/`runit` as the restart contract.

## Consequences

- Positive effects:
  - GitHub-hosted runners can reach the Android host without VPN or LAN reachability
  - the deploy path is now repo-defined instead of workstation-only knowledge
  - `sshd`, `galantesjewelry`, and `cloudflared` share the same supervised service model
- Tradeoffs:
  - deployment now depends on Cloudflare SSH hostname health
  - CI secrets must stay aligned with the `Production` environment, not only repository-level defaults
  - until Cloudflare Access is enforced, the SSH hostname is exposed more broadly than ideal
- Operational impact:
  - future deploy incidents should be debugged against the runbook in `project-memory/15-github-actions-termux-runbook.md`
  - boot troubleshooting must distinguish Play Store Termux from F-Droid Termux before recommending add-ons

## Evidence

- Validation:
  - `ssh galates-domain "hostname; whoami; echo final-check-ok"` passed through `ssh.galantesjewelry.com`
  - the Android host reported `run` for `galantesjewelry`, `cloudflared`, and `sshd`
  - `https://galantesjewelry.com/api/health` returned `200`
- Artifact:
  - `project-memory/evidence/github-actions-android-deploy-2026-03-29.md`
- Related change log entries:
  - `CHG-022`
  - `CHG-023`
  - `CHG-024`
  - `CHG-026`

## Sources

- Source: Cloudflare Tunnel SSH and routing documentation
  - Consulted on: 2026-03-29
  - Applied conclusion: a dedicated hostname such as `ssh.galantesjewelry.com` must route to `ssh://localhost:8022`
- Source: Cloudflare self-hosted application and service-token documentation
  - Consulted on: 2026-03-29
  - Applied conclusion: Access hardening is the correct next step after initial validation
- Source: Termux Play Store release and app documentation
  - Consulted on: 2026-03-29
  - Applied conclusion: the validated Play build integrates boot support and must not be mixed with the separate F-Droid `Termux:Boot` add-on
