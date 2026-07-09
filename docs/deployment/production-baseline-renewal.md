# Production Baseline Renewal

`https://github.com/JoelStalin/Galantesjewerly.git` must be renewed against production before it becomes the deploy source of truth. Production currently has many differences from the GitHub repository and must be reconciled without copying secrets or runtime data into git.

## Goal

Create an auditable branch that represents the versionable production code and configuration:

```text
production-baseline-renewal
```

## Source Comparison

Compare these sources:

- Local workspace: `GetUpSoft_Workspace/06_E_Commerce_Lux/Galantesjewelry`
- GitHub repo: `https://github.com/JoelStalin/Galantesjewerly.git`
- Production checkout: `/home/yoeli/galantesjewelry` on `galantes-prod-vm`

## Export From Production

On the VM:

```bash
cd /home/yoeli/galantesjewelry
scripts/production/export-production-baseline.sh
```

The export excludes:

- `.env*`
- `.git`
- `.next`
- `node_modules`
- backups
- dumps
- SQL exports
- tar archives
- runtime blobs
- private media

## Review Process

1. Create branch `production-baseline-renewal` from current `main`.
2. Apply the exported baseline into a clean clone.
3. Review diff file by file.
4. Confirm no secret or generated runtime artifact is present.
5. Run local validation.
6. Open PR to `main`.
7. Merge only after CI and human review.

## Acceptance Criteria

- The repo can build locally.
- Production runtime secrets are not committed.
- Production-only data is not committed.
- Current production functions are represented in versionable code.
- GitHub Actions can deploy from `main` after the branch is merged.
- `GetUpSoft_Workspace` is updated after merge.

