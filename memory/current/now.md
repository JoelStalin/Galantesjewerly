# Current State - Galantes Jewelry Production Recovery

## Project Phase
Production environment recovered after the failed April 28, 2026 deploy.

## Current Task
Production is stable again. The shop regressions, Google OAuth / Calendar recovery path, the Odoo category fallback for uncategorized products, and the invalid `shop_hero_image_url` settings lookup were fixed and revalidated. On April 30 the Google login endpoint and calendar availability checks were revalidated again after restoring `data/integrations.json`, and the production Cloudflare tunnel was reconnected on the live VM. The checkout now exposes insured shipping carrier selection, recalculates shipping server-side, and records a shipping service line in Odoo so Stripe and Odoo totals match. No rollback was executed after the user corrected the request. Recent performance work reduced build time by removing Turbopack workspace-root inference and caching Odoo settings in the root layout.
The restored operational CMS data is now persisted back into `galante.cms.settings` with the logo, hero image, contact address, email, phone, Instagram, Facebook, WhatsApp, and navigation JSON so Odoo remains the durable source of truth if the local cache is ever rebuilt.

## Next Actions
- Monitor live appointment submissions now that Google OAuth owner tokens and Calendar routing are restored.
- Commit the local recovery hardening and shop verification changes if they should become source-of-truth in git history.
- Monitor the new `Other` category fallback in Odoo now that the controller change is live.
- Keep the shipping selector flow under watch; the checkout now depends on the secure shipping service product and the shipping-rate API fallback.
- Keep `/account` redirects and Odoo settings reads on watch; the blank-page and invalid-field paths were just corrected.
- Keep the rollback path documented, but do not execute it unless explicitly requested again.
- Keep an eye on Odoo latency; the layout now times out quickly and falls back to local CMS data if Odoo is slow.

## Active Contracts
- Cloudflare tunnel: Live and serving `galantesjewelry.com`, `shop.galantesjewelry.com`, and `odoo.galantesjewelry.com`
- Web app: Healthy after rebuild from current VM source
- Odoo: Healthy after DB credential recovery
- CMS snapshot: Restored in both `data/cms.json` and `galante_cms_settings`
- Integrations snapshot: Restored, including the production Google OAuth config and calendar settings
- Shop controls: Sorting, category filters, PDP image gallery, and console health verified on production on April 28, 2026
- Selenium runtime: Uses the cloned local Chrome profile with extensions disabled to avoid third-party DOM injection during production verification
- Google OAuth admin callback: fixed to use the live request-derived redirect URI instead of a percent-encoded cookie value
- Production appointments: `googleCalendarId` restored to `ceo@galantesjewelry.com`
- Production Calendar auth: service account is preferred for Calendar operations; owner OAuth remains available for Gmail API mail delivery
- Odoo categories: uncategorized products now map to `Other` via `/api/products?category=Other` and `/api/categories`
- Odoo CMS settings: the client no longer requests the missing `shop_hero_image_url` field from `galante.cms.settings`
- Shipping checkout: carrier selection is available in `/checkout`, shipping is recomputed on the server, and Odoo now gets a dedicated secure shipping service line for totals parity

## Active Blockers
- None at the infrastructure/application layer. Remaining work is ordinary monitoring and git hygiene.

## Last Updated
2026-04-30 16:08 UTC
