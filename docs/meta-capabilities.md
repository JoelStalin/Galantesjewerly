# Meta Platform Capabilities & Limitations

## Overview

This document clarifies **what Meta platforms actually support** for product catalogs and e-commerce.
It prevents false claims and sets realistic expectations for MVP.

**Reference**: [Meta Catalog API Docs](https://developers.facebook.com/docs/marketing-api/catalog), [Facebook Shop](https://developers.facebook.com/docs/facebook-shop), [Instagram Shopping](https://developers.facebook.com/docs/instagram-api/guides/shopping)

---

## Platform-by-Platform Breakdown

### Facebook Shop

#### What It Does (✓ Supported)
- Displays product catalog from Meta Catalog
- Allows customers to browse products on Facebook
- Shows product details: name, price, image, description
- Enables "Add to Cart" within Facebook (if checkout configured)
- Integrates with Facebook Ads (DPA — Dynamic Product Ads)

#### What It Does NOT Do (✗ Not Supported)
- ✗ Automatic checkout within Facebook (redirects to external shop URL)
- ✗ Inventory sync in real-time (Meta caches; expect 1–4 hour lag)
- ✗ Custom product fields beyond Meta's schema
- ✗ Multi-currency pricing (one catalog = one currency)
- ✗ Variant management (SKU variations) — limited support

#### Setup Requirements
1. Facebook Business Account + Business Manager
2. Create Product Catalog in Commerce Manager
3. Connect catalog to Facebook Shop
4. Add products to catalog (via API or CSV bulk upload)
5. Publish shop on Facebook Page

#### Performance Notes
- Updates to Meta Catalog take 15 minutes to 4 hours to appear in Shop
- If price/availability changes in Odoo, Facebook Shop may still show old data
- Manual refresh available but not automatic

**MVP Status**: ✓ Ready, with caveat on sync lag

---

### Instagram Shopping

#### What It Does (✓ Supported)
- Tags products in organic feed posts
- Shows "View in Shop" button on product-tagged posts
- Displays product sticker with name, price, image
- Links to product detail (redirects to external shop URL)
- Integrates with Instagram Ads (DPA)

#### What It Does NOT Do (✗ Not Supported)
- ✗ Native checkout on Instagram (always redirects to external shop)
- ✗ In-app cart (users go to your shop)
- ✗ Inventory sync (same lag as Facebook)
- ✗ Direct messaging product details (use WhatsApp Business for that)
- ✗ Story-based shopping (limited to Feed)

#### Setup Requirements
1. Instagram Business Account (linked to Facebook)
2. Connected Product Catalog (same as Facebook)
3. Shopping-enabled account (eligibility check)
4. Approval by Meta (usually instant)

#### Performance Notes
- Product tags appear immediately in posts
- Sync lag same as Facebook (1–4 hours)
- Most effective for visual/lifestyle jewelry content

**MVP Status**: ✓ Ready, focus on organic posts + DPA ads

---

### WhatsApp Business Catalog

#### What It Does (✓ Supported)
- Display product catalog in WhatsApp Business app
- Customers can browse catalog within WhatsApp
- Send product messages via WhatsApp API
- Catalog appears in "Catalog" tab in WhatsApp Business

#### What It Does NOT Do (✗ Not Supported)
- ✗ No native "checkout" in WhatsApp (different use case)
- ✗ No "Buy Now" button (commerce not designed for WhatsApp)
- ✗ Real-time inventory sync (same lag as Facebook)
- ✗ Payment integration within WhatsApp
- ✗ Order tracking within WhatsApp (must use external system)

#### Real Use Case
WhatsApp is best for **customer service**, not point-of-sale:
1. Customer sees product in catalog (in-app)
2. Customer sends message: "I'm interested in the engagement ring"
3. WhatsApp Business agent responds with details, custom options, pricing
4. Customer clicks link to shop for checkout (on website)
5. Customer completes purchase on shop.galantesjewelry.com
6. Customer receives order confirmation via email or WhatsApp message

#### Setup Requirements
1. WhatsApp Business Account
2. Meta Business Manager
3. Connect Product Catalog (from Odoo sync)
4. Upload catalog to WhatsApp
5. Configure message templates (optional)

#### Performance Notes
- Catalog syncs on-demand or daily (same as Meta Catalog)
- Catalog appears in mobile WhatsApp app within minutes of upload
- No real-time inventory (Odoo updates → Galante's → Meta → WhatsApp = delayed)

**MVP Status**: ✓ Ready, but position as inquiry channel, not checkout

---

## What We CAN Promise (MVP)

| Feature | Support | Notes |
|---------|---------|-------|
| Product catalog visible on Facebook | ✓ Yes | Via Meta Catalog |
| Product catalog visible on Instagram | ✓ Yes | Via product tags in posts |
| Product catalog visible in WhatsApp | ✓ Yes | Via Catalog tab |
| Tag products in Instagram posts | ✓ Yes | Manual or automated |
| Run Instagram/Facebook DPA ads | ✓ Yes | From catalog |
| Redirect to shop for checkout | ✓ Yes | All platforms link to shop.galantesjewelry.com |
| Display product name, price, image | ✓ Yes | All platforms |
| Sync from Odoo to Meta Catalog | ✓ Yes | Daily cron job |
| Show stock availability | ✓ Yes | But with 1–4 hour lag |

---

## What We CANNOT Promise (MVP)

| Feature | Support | Why |
|---------|---------|-----|
| Instant inventory sync | ✗ No | Meta caches; lag unavoidable |
| Native checkout on Instagram | ✗ No | Instagram doesn't support it |
| Native checkout on Facebook | ✗ No | Facebook redirects to external URL |
| WhatsApp checkout | ✗ No | WhatsApp not designed for commerce |
| Real-time price updates | ✗ No | Same caching lag |
| Custom product fields | ✗ No | Limited to Meta's schema |
| Multi-currency catalogs | ✗ No | One catalog = one currency |
| Automated order notifications | ✗ No | Odoo handles orders; WhatsApp is inquiry-only |

---

## Recommended Messaging (Post-MVP)

### For Marketing
**ACCURATE:**
- "Browse our jewelry on Facebook, Instagram, and WhatsApp"
- "Shop products directly from Instagram posts and Facebook catalog"
- "Browse our collection, then complete your purchase on our website"

**INACCURATE / DO NOT USE:**
- ✗ "Shop directly on Instagram" (implies checkout on Instagram)
- ✗ "WhatsApp checkout" (WhatsApp is not a checkout platform)
- ✗ "Real-time inventory on Facebook" (implies instant updates)
- ✗ "Exclusive Instagram-only products" (all platforms show same catalog)

---

## Sync Architecture (MVP)

```
Odoo Database
  ↓ (daily cron at 00:00 UTC)
lib/integrations/meta.ts
  ↓ (batch API calls)
Meta Product Catalog
  ↓ (1–4 hour cache)
Facebook Shop ─── Instagram Shopping ─── WhatsApp Catalog
```

**Latency**:
- Odoo → Meta API: < 1 minute
- Meta cache refresh: 15 minutes to 4 hours
- Total: worst-case 4 hours from Odoo change to platform display

---

## Scaling Post-MVP

### For Near Real-time Sync (3-month horizon)
1. Replace daily cron with Odoo webhooks
2. Queue changes (RabbitMQ/SQS)
3. Sync within seconds instead of hours
4. Monitor API rate limits

### For Advanced Features (6-month horizon)
1. Dynamic Product Ads (DPA) targeting
2. Instagram Reels product placement
3. WhatsApp message templates (automated order updates)
4. Conversion tracking (UTM parameters, Facebook Pixel)

### For Omnichannel (12-month horizon)
1. Unified inventory across all channels
2. Per-channel publication rules (show on Instagram but not Facebook)
3. Channel-specific pricing strategies
4. Unified customer view across channels

---

## Known Issues & Workarounds

### Issue 1: Inventory Lag
**Problem**: Jewelry sells out in-store, but Facebook still shows "In Stock" for 4 hours.

**Workaround**:
- Manually mark as "Out of Stock" in Odoo
- Wait for sync cycle or trigger manual sync via API
- Post on Instagram/Facebook stories: "Just sold!" (manual notification)

**Better**: Set up inventory webhooks → instant sync (post-MVP)

### Issue 2: Product Image Quality
**Problem**: Meta reduces image quality for mobile viewing.

**Workaround**:
- Upload high-quality images (2000×2000px minimum)
- Test how they look in Meta preview
- Use ProductCard.tsx to compress images client-side

### Issue 3: Multi-Variant Products
**Problem**: Meta Catalog has limited variant support (e.g., "Gold Ring, Size 7").

**Workaround**:
- Create separate SKUs in Odoo for each variant
- Sync each variant as separate product
- Group in Meta (manually or via API)

---

## Testing Checklist

Before launching:
- [ ] Create test product in Odoo with available_on_website=True
- [ ] Run sync: `curl -X POST http://localhost:3000/api/integrations/meta/sync -H "Authorization: Bearer YOUR_TOKEN"`
- [ ] Check Meta Catalog (Commerce Manager) for product
- [ ] Wait 15 minutes, then check Facebook Shop
- [ ] Check Instagram Shopping (tag in test post)
- [ ] Check WhatsApp Business (Catalog tab)
- [ ] Verify all platforms show correct name, price, image
- [ ] Click "View in Shop" on each platform → redirects to shop.galantesjewelry.com/products/{slug}
- [ ] Test inventory change: mark product "Out of Stock" in Odoo, wait for sync, verify across platforms

---

## Support & Escalation

If Meta integration questions arise:
1. Check this doc (`docs/meta-capabilities.md`)
2. Check `integration-contracts/publication-flow.v1.md` for sync spec
3. Review `lib/integrations/meta.ts` for implementation details
4. Check `app/api/integrations/meta/sync/route.ts` for API usage
5. Escalate to WS-A (Orchestrator) if beyond scope

---

## References

- [Meta Catalog API Documentation](https://developers.facebook.com/docs/marketing-api/catalog)
- [Facebook Shop Guide](https://developers.facebook.com/docs/facebook-shop)
- [Instagram Shopping Setup](https://developers.facebook.com/docs/instagram-api/guides/shopping)
- [WhatsApp Catalog API](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/product-catalog)
- [Product Catalog Best Practices](https://www.facebook.com/business/help/1738681322029995)
