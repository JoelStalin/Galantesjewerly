# CMS vs. Commerce Boundary

## Overview

Clear separation between **editorial content** (managed in Next.js) and **product commerce** (managed in Odoo).

This document defines which system owns what data and prevents confusion about data ownership.

---

## System Ownership

| Domain | System | Source | Scope |
|--------|--------|--------|-------|
| **Editorial Content** | Next.js CMS | `data/cms.json` + Database | Marketing pages, branding, hero sections |
| **Product Catalog** | Odoo | `product.template` table | SKU, pricing, stock, images, availability |
| **User Accounts** | Odoo (future) | `res.partner` table | Customer data, orders, addresses |
| **Orders & Fulfillment** | Odoo | `sale.order` table | Shopping cart, checkout, payment, shipping |
| **Admin Panel** | Next.js | JWT auth (jose) | Internal: image upload, section management |

---

## Data Flows

### Editorial (Next.js)
```
Admin → Next.js Dashboard → Edit "Hero Section" in data/cms.json
  ↓
Homepage renders hero with marketing image & copy
  ↓
No impact on products or pricing
```

**Routes**: `/`, `/collections`, `/bridal`, `/journal`, `/repairs`, `/about`, `/contact`, `/privacy-policy`, `/terms-of-service`

**Data**: Stored in `data/cms.json` or PostgreSQL (admin-managed)

### Shop (Odoo)
```
Admin → Odoo Backend (odoo.galantesjewelry.com) → Create/Edit Product
  ↓
Set: name, price, material, slug, images, available_on_website=True
  ↓
Product appears on shop.galantesjewelry.com (Next.js fetches via API)
  ↓
Customer adds to cart → Odoo checkout → Odoo processes payment & fulfillment
```

**Routes**: `/shop`, `/shop/[slug]` (Next.js), Odoo eCommerce native checkout

**Data**: Stored in Odoo database (product.template, product.gallery, sale.order)

### Admin Panel (Next.js)
```
Admin → galantesjewelry.com/admin/dashboard
  ↓
Actions: 
  • Upload images (FeaturedCarousel, hero sections)
  • Edit CMS sections (hero copy, philosophy, testimonials)
  • View appointments
  ↗
No product management (that's Odoo's job)
```

---

## Data NOT Duplicated

### ✗ DO NOT duplicate product data in Next.js CMS
- Never copy product names, prices, or descriptions into `data/cms.json`
- Always fetch fresh from Odoo via `/api/products`
- Single source of truth = Odoo

### ✗ DO NOT duplicate customer data
- Never cache user accounts in Next.js
- Use Odoo as customer database (post-MVP)
- Next.js sessions ≠ Odoo accounts

### ✗ DO NOT recreate order history
- Odoo owns all sale orders
- Next.js displays links to checkout, not cart state

---

## Shared Boundaries

### Branding & Navigation
**Responsibility**: Both systems display consistent branding

- Logo, colors, fonts: defined in Tailwind config + Next.js components
- Header/footer: rendered by Next.js (shared across all pages)
- Links to shop: Next.js includes `/shop` link in navigation

### SEO Metadata
**Responsibility**: Next.js for editorial, Odoo fields for products

- Editorial pages: SEO title/description in `app/*/page.tsx` metadata
- Product pages: SEO from `product.template.name` + `shortDescription`
- Canonical URLs:
  - Editorial: `https://galantesjewelry.com/collections` (Next.js)
  - Products: `https://shop.galantesjewelry.com/products/{slug}` (Odoo)

### Email & Notifications
**Responsibility**: Odoo sends transactional emails, Next.js optionally sends marketing

- Order confirmation: Odoo (via SMTP config)
- Appointment reminders: Next.js (Google Calendar integration)
- Newsletter signup: (not yet implemented; future decision)

---

## API Contract

### Next.js → Odoo (via `lib/odoo/client.ts`)

**Fetch products for `/shop`**:
```ts
const products = await client.getProducts(); // → Odoo /api/products
// Returns: ShopProduct[] with schema from integration-contracts/shop-product.v1.ts
```

**Fetch product detail for `/shop/[slug]`**:
```ts
const product = await client.getProductBySlug(slug); // → Odoo /api/products/{slug}
// Returns: ShopProduct with full details (longDescription, gallery, etc.)
```

**Buy flow**:
```
User clicks "Add to Cart" → opens Odoo cart (via product.buyUrl)
→ Odoo handles checkout & payment
→ Odoo stores order in database
→ Odoo sends order confirmation email
```

---

## Testing & Validation

### Test 1: Editorial pages still work
```bash
npm run dev
# Visit http://localhost:3000/
# Verify: hero, philosophy, testimonials, contact form all render
# Verify: no console errors related to missing Odoo data
```

### Test 2: Shop pages render
```bash
# Ensure Odoo is running: docker-compose up (in odoo/)
npm run dev
# Visit http://localhost:3000/shop
# Verify: products load from Odoo (or fallback message if Odoo down)
# Verify: product detail page loads with images & description
# Verify: "Add to Cart" button links to shop.galantesjewelry.com
```

### Test 3: No data duplication
```bash
# Grep for product names in CMS
grep -r "Engagement Ring" data/cms.json
# Should return: nothing (only in Odoo)
```

### Test 4: Admin panel works
```bash
npm run dev
# Visit http://localhost:3000/admin/login
# Log in with ADMIN_USERNAME / ADMIN_PASSWORD
# Verify: dashboard loads, image upload works
# Verify: no product management in admin (that's Odoo)
```

---

## Deployment Impact

### Next.js Services
- Restart: blog, editorial, admin panel affected
- **Does NOT affect**: Product catalog (Odoo serves independently)

### Odoo Services
- Restart: shop, checkout affected
- **Does NOT affect**: Editorial pages (Next.js serves independently)

**Implication**: Can deploy Next.js and Odoo on different schedules.

---

## Future Enhancements (Post-MVP)

1. **Unified Search**: Include both editorial + products in global search
2. **Related Products**: On editorial pages, suggest related jewelry pieces
3. **Wishlist/Favorites**: User accounts in Odoo, liked products stored there
4. **Smart Routing**: Route `/collections` to editorial OR to Odoo category filters
5. **Inventory Alerts**: When out-of-stock product is updated in Odoo, notify subscribed users

All of these respect the boundary: Next.js orchestrates UX, Odoo owns commerce data.

---

## Questions?

Refer to `docs/open-questions.md` if the boundary is unclear, or escalate to WS-A (Orchestrator).
