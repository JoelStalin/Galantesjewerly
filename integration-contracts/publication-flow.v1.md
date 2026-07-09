# Product Publication Flow v1

## Overview

This contract defines **when** and **how** products transition from Odoo inventory to external channels (website, Meta, WhatsApp).

**Applies to**: WS-B (Odoo) → WS-C (Frontend) → WS-D (Meta/social)

---

## Publication State Machine

```
Odoo Product Created
    ↓
[available_on_website = True] ← must be set manually in Odoo
    ↓
Product Published to Shop (shop.galantesjewelry.com)
    ↓
[available_on_website = True AND inventory synced] ← daily cron or manual trigger
    ↓
Product Synced to Meta Catalog (if enabled)
```

### Status Definition

A product is **"published"** when **ALL** of these are true:

1. `product.template.available_on_website = True` (admin-set flag)
2. `product.template.active = True` (default, unless archived)
3. `product.template.material` is set (jewelry-specific metadata)
4. `product.template.slug` is not empty (auto-generated or manual)
5. `product.template.list_price > 0` (prevents $0 listings)
6. At least one **primary image** is attached

---

## Data Required per Channel

### For Web (shop.galantesjewelry.com)

Required fields:
- `name` (product title)
- `slug` (URL safe: `/product/slug`)
- `list_price` (currency from company)
- `default_code` (SKU)
- `image_1920` (primary image)
- `availability_status` (computed from stock)

Optional but recommended:
- `description_sale` (product description)
- `categ_id` (category: rings, bridal, etc.)
- `material` (gold, silver, etc.)
- `barcode` (for tracking)

### For Meta Catalog

**Minimum required** (per Meta Product Catalog API):

- `id` (Odoo product.template.id)
- `name` (max 100 chars)
- `description` (max 5000 chars)
- `price` (in base currency, no symbols)
- `currency` (3-letter code, e.g., USD)
- `image_url` (https, 1:1 aspect ratio, min 500×500px)
- `url` (product detail page: `shop.galantesjewelry.com/products/{slug}`)
- `sku` (if using Facebook/Instagram Shop)

**Optional but improves performance**:

- `brand` ("Galante's Jewelry")
- `category` (jewelry category string)
- `material` (material type)
- `availability` (in stock / out of stock / preorder)
- `additional_image_urls` (gallery images)

### For WhatsApp Business Catalog

WhatsApp uses Meta's Product Catalog (same sync as Facebook/Instagram).

Additional note: WhatsApp does **not** have a native "shop" feature. Use:
- **Catalog browsing** via WhatsApp Clicks
- **Product inquiries** via message buttons
- **Order conversations** via WhatsApp Business API

---

## Sync Trigger & Frequency

### MVP Publication Flow

**Step 1: Manual Trigger in Odoo**
- Admin sets `available_on_website = True` on a product
- Product appears on shop.galantesjewelry.com (within 1 hour)

**Step 2: Daily Sync to Meta** (if enabled)
- Cron job runs daily at **00:00 UTC** (or configurable time)
- Pulls all products where `available_on_website = True`
- Compares against last sync (via `meta_synced_at` timestamp)
- Posts to Meta Catalog API
- Logs sync result (success/error)

**Step 3: Error Handling**
- If a product fails Meta sync:
  - Log error with product ID and reason
  - Retry on next daily run
  - Admin notified via email (optional)
  - Product remains available on shop (no blocking)

### Future (Post-MVP) Real-time Sync

When scale warrants:
- Use Odoo webhooks or database triggers
- Publish message to queue (RabbitMQ, SQS)
- Sync to Meta within seconds (not hours)
- Implement per-channel backoff & retry logic

---

## Availability Mapping

| Odoo Stock | Availability Status | Shop Display | Checkout |
|------------|-------------------|--------------|----------|
| qty > 0 | `in_stock` | "In Stock" | Allow add-to-cart |
| qty = 0, allow backorder | `preorder` | "Pre-order Available" | Allow with note |
| qty = 0, no backorder | `out_of_stock` | "Out of Stock" | Disable checkout |

---

## URL Conventions

### Canonical URLs (for SEO)

| Resource | URL Pattern | Example |
|----------|------------|---------|
| Product detail | `shop.galantesjewelry.com/products/{slug}` | `shop.galantesjewelry.com/products/engagement-ring-14k-gold` |
| Category | `shop.galantesjewelry.com/category/{category}` | `shop.galantesjewelry.com/category/bridal` |
| Buy action | `shop.galantesjewelry.com/product/{slug}` | (Odoo redirects to canonical or handles cart) |

---

## Meta Integration Specifics

### What Meta Supports (True)
- ✓ Facebook Shop catalog (auto-sync from Product Catalog)
- ✓ Instagram Shopping (tags products in feed posts)
- ✓ Meta Catalog API (REST endpoint for updates)
- ✓ Product variants (via catalog format)
- ✓ Inventory sync (stock status per product)
- ✓ Ads Manager integration (DPA ads from catalog)

### What Meta Does NOT Support (False Claims to Avoid)
- ✗ Automatic checkout on Instagram (users go to shop)
- ✗ WhatsApp checkout (WhatsApp has no native cart; use business API)
- ✗ Real-time inventory (Meta caches; expect 1–4 hour lag)
- ✗ Custom product fields beyond Meta's schema
- ✗ Price syncing via API (must use Odoo as source; Meta caches aggressively)

**See `docs/meta-capabilities.md` for full breakdown.**

---

## Versioning & Breaking Changes

### v1 (current)
- Initial release: daily cron-based sync, manual publication flag
- Applies to: all channels (Web, Meta, WhatsApp)

### Future: v2 (if changes needed)
- Real-time sync (deprecates daily cron)
- Per-channel publication flags (separate from `available_on_website`)
- Webhook support for product updates
- Would require update to this file + notification to all WS teams

**Supersession rule**: If v2 is introduced, DEC-002 (or higher) must be logged in `docs/decision-log.md`.

---

## Workflow Example

```bash
# As Odoo admin in product.template form:

1. Create new product "Engagement Ring 14K Gold"
   - Name: "Engagement Ring 14K Gold"
   - Category: Bridal
   - Material: Gold
   - Price: $2,499.00
   - Image: [upload image]

2. Set available_on_website = True ✓

3. Click Save

→ Slug auto-generates: "engagement-ring-14k-gold"
→ Within 1 hour: appears on shop.galantesjewelry.com/products/engagement-ring-14k-gold

4. Next 00:00 UTC: daily cron runs
   → Syncs to Meta Catalog
   → Instagram Shopping tag available
   → Facebook Shop listing created

5. If price changes:
   - Update list_price in Odoo
   - Wait for next daily cron
   - Meta Catalog updates (with cache lag)
```

---

## Questions & Decisions

See `docs/open-questions.md`:
- **Q-002**: Should publication be per-channel (e.g., "show on Web" vs. "show on Meta")?
- **Q-003**: Should real-time sync be MVP or post-MVP?

If you have new questions, add to Q-00X in `docs/open-questions.md` and notify WS-A (orchestrator).
