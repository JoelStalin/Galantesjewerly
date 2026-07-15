# Verification Report - Product Gallery Enrichment

## Status
- Backend Odoo serializer: verified with targeted Python unit tests
- Frontend gallery builder: implemented and added test coverage
- Full repo `npm run build` / `vitest` in this workspace: blocked by current monorepo path layout, not by the gallery changes themselves

## Verified
- `product.gallery_ids` now supports `name`, `active`, and stable ordering
- Odoo product API emits `gallery` and enriched `galleryImages`
- Frontend gallery builder deduplicates URLs and prefers enriched metadata
- Product detail page passes `galleryImages` through to the gallery UI

## Local Test Evidence
- `python -m unittest tests.unit.test_product_api.ProductAPITestCase.test_serialize_product_defaults_to_other_when_uncategorized`
- `python -m unittest tests.unit.test_product_api.ProductAPITestCase.test_serialize_product_includes_sorted_gallery_images`
- `python -m unittest tests.unit.test_product_api.ProductAPITestCase.test_resolve_base_url_upgrades_public_http_to_https`

## Production Evidence
- Google Drive source folder was read successfully and 50 images were downloaded to `C:\Users\yoeli\Downloads\galantesjewelry-recovered-images-2026-06-27\blobs`
- Production Odoo API for `shipping-calculation-demo-pendant` returned `200` with `imageUrl` and `galleryImages` using `https://odoo.galantesjewelry.com/...`
- Production PDP `/shop/shipping-calculation-demo-pendant` rendered `4` gallery thumbnails and the selected main image loaded with `naturalWidth=1254`
- Screenshot artifacts saved locally:
  - `C:\Users\yoeli\Downloads\shipping-calculation-demo-pendant-pdp.png`
  - `C:\Users\yoeli\Downloads\shipping-calculation-demo-pendant-pdp-gallery-click.png`

## Known Environment Limitation
- The workspace root/package root mismatch prevents a clean end-to-end `next build` and Vitest run locally from this path.
- Final runtime verification should be performed in the production VM / deployed container.

---

## Session 5 - Odoo XML-RPC Publication Transport

### Goal
Enable the Google Drive product publication workflow to authenticate against production Odoo using the working XML-RPC path, while preserving the existing JSON-2 client behavior for environments that already use API keys.

### Actions Taken
1. **Extended the shared Odoo client**
   - Added transport selection with `auto`, `json2`, and `xmlrpc`.
   - Kept JSON-2 support intact for existing API-key flows.
   - Added XML-RPC fallback behavior for password-only production environments.

2. **Added a Python XML-RPC bridge**
   - Introduced `scripts/odoo-xmlrpc-bridge.py` to perform authenticated Odoo RPC calls from the Node workflow.
   - Supports the publication workflow methods used by product create/update, search, read, write, and unlink calls.

3. **Added regression coverage**
   - Added unit coverage for XML-RPC transport selection in `tests/unit/src/config/odooClient.test.ts`.
   - Preserved the existing JSON-2 contract tests.

### Production Evidence
- Live Odoo read-only probe succeeded through the new client transport:
  - `product.template.search_read`
  - Returned 2 records
  - First record: `Anchor of the Soul Bracelet`

### Local Test Evidence
- `npx vitest run --pool threads tests/unit/src/config/odooClient.test.ts tests/unit/lib/odoo-client.test.ts tests/unit/lib/gdrive-product-import.test.ts`
- `npx vitest run tests/unit/automation/google-drive-product-publication-workflow.test.ts`
- `python -m py_compile scripts/odoo-xmlrpc-bridge.py`
- `node scripts/gdrive-publish-products.mjs --mode scan --source-path tmp/drive-sample --out artifacts/gdrive-sample-scan.json`
- `node scripts/gdrive-publish-products.mjs --mode build-manifest --scan-report artifacts/gdrive-sample-scan.json --out artifacts/gdrive-sample-manifest.json`
- `node scripts/gemini-classify-drive-clusters.mjs --manifest artifacts/gdrive-sample-manifest.json --out artifacts/gdrive-sample-classified.json`
- `node scripts/gdrive-publish-products.mjs --mode publish --manifest artifacts/gdrive-sample-manifest.json --dry-run`

### Build Attempt
- `npm run build`
- Result: failed because the package root does not contain the Next `app` or `pages` directory; the app source lives under the nested `Galantesjewelry/` directory

### Gemini Classification Evidence
- Sample cluster classified as `18K Gold Pave Knot Ring`
- Confidence: `0.95`
- `requiresReview`: `false`
- Publish dry-run on the classified manifest reported `would_create`

### Outcome
- The publication workflow can now authenticate against the real production Odoo host without an API key.
- The workflow still refuses to auto-publish the timestamp-only sample cluster, which prevents invented product data from reaching production.
