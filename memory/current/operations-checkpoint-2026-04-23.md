# Operations Checkpoint - 2026-04-23

## Purpose
Detailed operational memory snapshot to preserve the exact working context, production state, evidence, unresolved threads, and next safe actions.

## Production Infrastructure
- VM: `galantes-prod-vm`
- Zone: `us-central1-a`
- Main public hosts:
  - `https://galantesjewelry.com`
  - `https://admin.galantesjewelry.com`
  - `https://odoo.galantesjewelry.com`
  - `https://shop.galantesjewelry.com`
- Core containers expected:
  - `galantes_web_v4`
  - `galantes_odoo`
  - `galantes_db`
  - `galantes_nginx`
  - `galantes_tunnel_prod`

## Production Facts Already Verified
- Public and admin health endpoints were green during the latest stabilized state.
- Odoo health endpoint was green.
- Shop subdomain resolves and serves the frontend.
- Google Calendar production OAuth is connected for `ceo@galantesjewelry.com`.
- Appointment integration config in production was updated so `googleCalendarId` targets `ceo@galantesjewelry.com`.
- Appointment booking was validated end-to-end:
  - appointment created
  - slot became unavailable afterward
  - Google event existed
  - Odoo appointment existed

## Appointment Evidence Captured Earlier
- Example successful appointment evidence from production:
  - `appointmentId`: `appt_1776979521549_488de0c0`
  - `odooAppointmentId`: `31`
- Event link now points to the owner calendar rather than the service-account `primary`.
- Event title contract already changed to:
  - `Inquiry Type - Customer Name`

## Production UI/Branding Fixes Already Completed
- Browser tab title now follows the admin-configured `brand_name`.
- Account subroutes use `sticky` navbar behavior instead of interfering `fixed` behavior.
- Social floating buttons were restored earlier and preserved.
- Admin panel exposes editable appointment schedule fields:
  - timezone
  - duration
  - start time
  - end time
  - slot interval
  - weekday availability

## Selenium / Functional Test Evidence Already Captured
- `scripts/verify_production_appointment_calendar_profile9.py`
  - production appointment creation passed
  - Google Calendar verification passed
- `scripts/verify_admin_branding_host_profile9.py`
  - admin branding change + restoration passed
  - browser title validation passed
- `scripts/verify_account_navbar_profile9.py`
  - `/account/orders`, `/account/invoices`, `/account/settings`
  - navbar `position: sticky`
  - no overlap with content

## Current Active User Requirements
1. Preserve operational memory in detail.
2. Before next production mutation, ensure safe backup.
3. Validate complete sale so orders and invoice appear in Odoo and customer account.
4. Ensure products created in Odoo with image propagate visually to `shop.galantesjewelry.com`.

## Current Investigation - Storefront Product Images
- Real catalog source is Odoo, not the shop host API path.
- Confirmed:
  - `https://odoo.galantesjewelry.com/api/products?pageSize=3` returns catalog JSON.
- Important finding:
  - many returned products currently have `"imageUrl": null`
- Conclusion:
  - current issue is upstream in data/API serialization, not yet proven to be a Next.js rendering bug.

## Relevant Code Paths For Product Images
- `odoo/addons/galantes_jewelry/controllers/product_api.py`
  - `_serialize_product`
  - main image currently derived only from `product.template.image_1920`
  - gallery images derived from `gallery_ids`
- `components/shop/ProductCard.tsx`
  - renders `product.imageUrl` with `next/image`
- `components/shop/ProductGallery.tsx`
  - renders `mainImage` and gallery URLs with `next/image`
- `app/shop/[slug]/page.tsx`
  - pulls product and related products from Odoo client

## Current Investigation - Sales / Orders / Invoices
- A QA customer account was created earlier in production.
- A product lookup in production succeeded through Postgres; one valid example product found was:
  - product id `21`
  - name `Triton's Trident Tie Bar`
  - price `650.0`
- Earlier attempt to use interactive Odoo shell failed because it tried to bind an already-used port.
- Correct continuation path:
  - use `odoo shell --no-http`
  - or use safe model/RPC/SQL commands

## Backup State
- User requirement: backup before production changes.
- Earlier in the session, multiple backups were created successfully for previous production deployments.
- During the most recent investigation, a fresh backup creation was started again but not confirmed because:
  - remote helper script `scripts/backup/predeploy-backup.sh` is not present on the VM checkout
  - manual backup command was being rewritten to avoid PowerShell quoting issues
  - the turn was interrupted before a new confirmed backup path was printed
- Therefore:
  - do not assume a fresh backup for the next mutation exists yet
  - first step on resume is to create one and record its absolute path

## Repo / Operational Safety Notes
- Local worktree is heavily dirty; unrelated changes exist across many files.
- Avoid broad resets or cleanup.
- Use surgical patches only.
- Do not expose secrets or passwords in memory files.

## Backlog / Deferred Decisions
- `ODOO-INT-002`: re-enable appointment email notifications with Google
- User explicitly said email notifications should remain deferred for now.

## Recommended Resume Sequence
1. Create and confirm fresh remote backup path on VM.
2. Create/update QA product with real image in Odoo.
3. Verify Odoo product API returns `imageUrl`.
4. Verify `shop.galantesjewelry.com/shop/<slug>` renders the image.
5. Execute QA sale/order/invoice flow.
6. Validate `/account/orders` and `/account/invoices` with Selenium `Profile 9`.
7. Refresh memory and evidence after each mutation.
