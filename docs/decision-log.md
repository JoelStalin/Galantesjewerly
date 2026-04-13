# Decision Log

## DEC-001 — MVP Checkout Strategy

- **Date**: 2026-04-13
- **Status**: accepted
- **Context**:
  - Galante's Jewelry needs an e-commerce layer (product catalog, shopping cart, payment checkout)
  - Two main options:
    1. Custom Next.js checkout (higher control, more code, longer timeline)
    2. Native Odoo Website/eCommerce (leverages Odoo's built-in e-commerce, faster, Odoo as source of truth)
  - Existing site is editorial + admin; no current commerce layer
  - Goal: MVP that reuses existing infrastructure without rewriting current site

- **Decision**: 
  Use **Odoo Website/eCommerce native checkout** as the primary commerce flow for MVP.
  - Shop storefront at `shop.galantesjewelry.com` runs Odoo Website module
  - Product catalog sourced from Odoo (SKU, pricing, stock, images, descriptions)
  - No custom checkout code in Next.js
  - Future: if advanced customization needed, can add a Next.js cart proxy, but MVP does not require it

- **Consequences**:
  - ✓ Faster MVP: leverage Odoo's proven e-commerce module
  - ✓ Single source of truth: Odoo owns product, price, stock, orders
  - ✓ Minimal custom code in Next.js: focus on branding/discovery layer if needed
  - ✓ Scalable: Odoo handles inventory, fulfillment, customer data
  - ✗ Brand/UX customization limited to Odoo Website theming (acceptable for MVP)
  - ✗ Requires Odoo instance (WS-B dependency) before shop can launch

- **Supersedes**: None
