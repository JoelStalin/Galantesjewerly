# Galantes Deployment Runbook

## Non-Negotiable Rules

- No direct production changes as the normal path.
- Production deploys only from `Galantesjewerly.git` through GitHub Actions.
- Production requires GitHub Environment approval.
- Production backup is blocking.
- Do not restart, recreate, replace, or reroute `cloudflared` unless the user approves that exact tunnel operation.
- Do not delete images, Odoo media, galleries, Google Drive source photos, orders, invoices, appointments, or customer records without explicit approval.

## Branch Flow

1. Work branch from `develop`.
2. Local validation.
3. Pull request to `develop`.
4. CI passes.
5. Merge to `develop`.
6. Staging deploy runs.
7. Staging evidence is reviewed.
8. Pull request `develop -> main`.
9. CI passes and review approves.
10. Manual `Deploy Production` workflow runs from `main`.

## Local Validation

Run before requesting review:

```bash
npm ci
npm run lint
npx tsc --noEmit
npm run test
npm run build
```

For storefront or image changes, also run the project Selenium/Profile 9 checks required by `AGENTS.md`.

## Production Deployment

Use GitHub Actions workflow:

```text
Deploy Production
```

Inputs:

- `confirm_backup`: must be `BACKUP_REQUIRED`.
- `force_rebuild`: use only when code diff detection is not enough.

The workflow SSHes into the VM and runs:

```bash
scripts/production/preflight.sh
scripts/production/deploy-from-github.sh "$TARGET_SHA"
```

## Backup

Backup script:

```bash
scripts/production/predeploy-backup.sh
```

Required output:

```text
/home/yoeli/deploy-backups/<timestamp>-<sha>/
```

The backup contains:

- `galantes_prod.dump`
- `app-data.tgz`
- Docker inspect output
- resolved compose file
- Docker volume archives when available
- `.env.prod` only on the VM with restricted permissions
- `backup.json`

## Rollback

Rollback must be explicit and evidence-based.

1. Identify the backup path.
2. Identify the target commit SHA.
3. Confirm whether rollback touches DB, app data, Odoo filestore, or only web code.
4. Ask for approval before any production mutation.
5. Restore only the required layer.
6. Validate `/api/health`, `/shop`, representative images, Odoo login, checkout preflight, and calendar/Odoo sync if affected.

## GitHub Required Settings

Configure branch protection:

- Protect `main`.
- Require pull request before merge.
- Require status checks to pass.
- Require `CI`.
- Disallow force pushes.
- Disallow deletion.

Configure environments:

- `staging`: staging secrets only.
- `production`: production SSH secrets, required reviewers, branch limited to `main`.

Initial GitHub protection can be applied with:

```bash
REPO=JoelStalin/Galantesjewerly scripts/github/configure-repository-protection.sh
```

Reviewers for the production environment may still need to be set in the GitHub UI depending on repository plan/API permissions.

## Workspace Sync

After a PR lands in `Galantesjewerly.git`, keep `GetUpSoft_Workspace` aligned with:

```bash
CANONICAL_URL=https://github.com/JoelStalin/Galantesjewerly.git BRANCH=main scripts/github/sync-workspace-from-canonical.sh
```

The sync script refuses to run if the workspace has uncommitted changes.
