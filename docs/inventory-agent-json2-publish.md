# Inventory JSON-2 publication gate

The inventory worker runs locally. Drive download, image conversion/features,
clustering, review preparation, and the Odoo dry-run must complete on the local
worker before production dispatch. The only production publisher is
`scripts/inventory-agent/odoo-json2-publish.mjs`, invoked by a GitHub Actions job
using the protected `production` environment with a validated local bundle.

Required gates, in order:

1. The review queue contains explicit `approvePublish=YES`, `price`, `cost`,
   and `stock` for every row; unresolved merge/split rows are rejected.
2. `review:import` succeeds and `odoo:dry-run` reports `ok=true` with no
   payload errors. Stock remains an approval value and is not written to
   computed `qty_available`.
3. `odoo:fields-export` succeeds and the DTO coverage has no missing fields.
4. The protected GitHub `production` environment approves the run and the
   predeploy backup succeeds. A failed backup must stop the job.
5. The job sets `GITHUB_ACTIONS=true`, `GITHUB_ENVIRONMENT=production`, and
   `INVENTORY_AGENT_PRODUCTION_APPROVED=true`, then runs the JSON-2 publisher.
6. Post-publication Selenium Profile 9 evidence verifies `/api/health`, `/shop`,
   a representative PDP, and every representative image has `naturalWidth > 0`.

The publisher is additive/idempotent by `default_code` (`GAL-<clusterId>`).
The production workflow now downloads the approved Drive batch into the
ephemeral runner workspace and materializes no credentials in git. Products
are created as Odoo drafts (`is_published=false`, `website_published=false`)
so the owner can publish them manually from Odoo.

Inventory cleanup is destructive and is a separate explicit gate: the
workflow input must equal `CLEANUP_CURRENT_INVENTORY`, the protected
`production` environment must approve it, and the VM backup script must finish
successfully before the JSON-2 publisher deletes existing `product.template`
records. The workflow never deletes customer, order, calendar, tunnel, or
proxy data.
