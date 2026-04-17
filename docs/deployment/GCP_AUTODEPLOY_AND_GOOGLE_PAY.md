# GCP Auto-Deploy + Google Pay (Odoo)

## Objective
Deploy this production stack to Google Cloud with a monthly target under USD 30 and enable Google Pay in checkout.

## Current architecture in this repository
- Frontend/API: Next.js (`web`)
- ERP/checkout: Odoo (`odoo`)
- Database: PostgreSQL (`postgres`)
- Reverse proxy: Nginx (`nginx`)
- Checkout strategy already decided in project docs: Odoo native checkout

## Cost profile (target <= USD 30/month)
Recommended baseline:
- 1x VM `e2-small`
- 30GB `pd-balanced`
- Single public static IP
- Docker compose stack (without cloudflared in VM deployment)

Typical monthly range (depends on traffic and region):
- VM + disk + IP: ~USD 20-28/month
- Keep budget alerts at 50%, 90%, 100%

## Automatic deployment script
Use:
- `scripts/gcp/deploy-gcp-budget.ps1`

What it automates:
1. Validates `gcloud`.
2. Creates/uses GCP project.
3. Optionally links billing + creates a USD budget.
4. Enables required APIs.
5. Creates firewall rule for ports 80/443.
6. Creates a VM and runs startup bootstrap (`scripts/gcp/vm-startup.sh`).
7. Clones repository on VM, uploads local `.env.prod` and launches:
   - `postgres`, `odoo`, `web`, `nginx`

### Example
```powershell
powershell -ExecutionPolicy Bypass -File scripts/gcp/deploy-gcp-budget.ps1 \
  -ProjectId "galantes-jewelry-prod" \
  -ProjectName "Galantes Jewelry Production" \
  -BillingAccount "XXXXXX-XXXXXX-XXXXXX" \
  -BudgetUsd 30 \
  -MachineType "e2-small" \
  -BootDiskGb 30 \
  -Branch "main"
```

## Google Pay integration (production-safe path)
Because checkout is Odoo-native, Google Pay should be enabled through Stripe provider:

1. Configure Stripe provider in Odoo.
2. Enable Google Pay in Stripe dashboard.
3. Odoo checkout will present Google Pay on supported devices/browsers.

Automation helper included:
- `scripts/odoo/enable_google_pay.py`

### Example usage
```bash
export ODOO_URL="https://shop.galantesjewelry.com"
export ODOO_DB="galantes_db"
export ODOO_USERNAME="admin"
export ODOO_PASSWORD="<odoo-admin-password>"
export STRIPE_PUBLISHABLE_KEY="pk_live_..."
export STRIPE_SECRET_KEY="sk_live_..."
export STRIPE_WEBHOOK_SECRET="whsec_..."
python3 scripts/odoo/enable_google_pay.py
```

## Notes
- If `cloudflared` token is invalid, keep cloudflared stopped and run directly with VM public IP/domain.
- For strong production hardening, add HTTPS termination (managed cert/load balancer) and backup policy for PostgreSQL volume.
