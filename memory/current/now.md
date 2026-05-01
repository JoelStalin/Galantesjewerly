# Current State - Galantes Jewelry Production Recovery

## Project Phase
Production environment recovered after the failed April 28, 2026 deploy.

## Current Task
Production is stable again. The shop regressions, Google OAuth / Calendar recovery path, the Odoo category fallback for uncategorized products, and the invalid `shop_hero_image_url` settings lookup were fixed and revalidated. On April 30 the Google login endpoint and calendar availability checks were revalidated again after restoring `data/integrations.json`, and the production Cloudflare tunnel was reconnected on the live VM. The checkout now exposes insured shipping carrier selection, recalculates shipping server-side, and records a shipping service line in Odoo so Stripe and Odoo totals match. No rollback was executed after the user corrected the request. Recent performance work reduced build time by removing Turbopack workspace-root inference and caching Odoo settings in the root layout.
The restored operational CMS data is now persisted back into `galante.cms.settings` with the logo, hero image, contact address, email, phone, Instagram, Facebook, WhatsApp, and navigation JSON so Odoo remains the durable source of truth if the local cache is ever rebuilt.
The account layout spacing has now been widened locally so the fixed navbar no longer overlaps the `/account` content in source, but the live production smoke still reflects the previously deployed build until that code is redeployed.
The GCP repo sync path now preserves the live `data/` tree before `git reset --hard` and restores it afterward, so code deploys no longer risk wiping CMS or integration state stored in the repo.
I also created a rollback backup on the production VM at `/home/yoeli/galantesjewelry/backups/predeploy/20260501_023923`; it includes `galantes_db.sql`, `postgres-data.tgz`, `odoo-data.tgz`, `app-data.tgz`, and runtime logs/inspects for the live stack.
The runtime-only release package was then deployed to `/home/yoeli/galantesjewelry` on the GCP VM, the `galantes_web` container was rebuilt with `.env.prod`, and the public health endpoint returned `ok` after cutover.
The `/account/addresses` auth-guard follow-up is now complete, matching the redirect behavior used by the other account pages.
Customer login links now preserve the current URL through `returnTo`, so clicking login from the cart or another page brings the user back to the same location after authentication.
Customer sessions are now durable until logout as well, so the authenticated customer sections stay available across navigation without expiring on the short 30-day window.
The login-return flow was then verified with a real Selenium run against a local Next.js server: cart -> login -> cart worked, logout returned home, and `/account/orders` redirected back to login after logout.
I then tightened the customer auth surface: the shared account layout now redirects unauthenticated visitors centrally, and the login `returnTo` sanitizer rejects `/auth` routes so users cannot bounce through logout or other auth pages after signing in. That follow-up was validated again with targeted Vitest, lint, and a fresh Selenium run against `http://127.0.0.1:3001`; the browser logs showed only the expected development/Odoo fallback noise and the flow still passed end to end.
Next 16 then blocked the production build because both `middleware.ts` and `proxy.ts` were present, so I migrated the request-header logic into `proxy.ts`, removed `middleware.ts`, and hardened the GCP deploy scripts to use the real VM path and `sudo docker compose` against the actual compose services. After that the production stack rebuilt cleanly and the live Selenium QA against `https://galantesjewelry.com` confirmed the customer invoices page loads without redirecting to login.

## Next Actions
- Monitor live appointment submissions now that Google OAuth owner tokens and Calendar routing are restored.
- Commit the local recovery hardening and shop verification changes if they should become source-of-truth in git history.
- Monitor the new `Other` category fallback in Odoo now that the controller change is live.
- Keep the shipping selector flow under watch; the checkout now depends on the secure shipping service product and the shipping-rate API fallback.
- Keep `/account` redirects and Odoo settings reads on watch; the blank-page and invalid-field paths were just corrected.
- Redeploy the account layout spacing fix before expecting the live Selenium account-navbar smoke test to pass.
- The `/account/addresses` auth guard fix is complete and validated.
- Customer login links now preserve `returnTo` for the current page, including the cart.
- Customer sessions now share the long-lived durability model used by Google sign-in until explicit logout.
- Real Selenium QA confirmed the cart login returnTo flow and logout blocking behavior.
- The shared account layout now owns the unauthenticated redirect, and auth-page `returnTo` values are sanitized before login completes.
- The latest Selenium pass against `http://127.0.0.1:3001` confirmed the hardened flow still works end to end.
- The production build now uses `proxy.ts` only; the Next 16 middleware/proxy conflict is gone.
- Production stack restart completed on the GCP VM, and live Selenium confirmed `/account/invoices` loads from a valid customer session without bouncing to `/auth/login`.
- Keep the rollback path documented, but do not execute it unless explicitly requested again.
- Keep an eye on Odoo latency; the layout now times out quickly and falls back to local CMS data if Odoo is slow.
- Keep the shared skill docs under watch; the broken relative links in the skill tree were repaired and revalidated.
- Odoo JSON-2 404 responses now fail fast without retries, and the regression test suite passed for the client hardening.
- Appointment flow now emits structured Odoo sync diagnostics for success, skip, and failure paths, with a focused unit test in place.
- GCP production sync now snapshots `data/` around the repo update, which protects operational JSON state during the next handoff.
- Rollback backup is available on the VM at `/home/yoeli/galantesjewelry/backups/predeploy/20260501_023923`.
- Runtime-only production cutover completed on the live VM; `galantes_web` is healthy and serving the deployed build.

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
2026-05-01 21:42 UTC
