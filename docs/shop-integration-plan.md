# Shop Integration Plan — Galante's Jewelry

## Architecture (MVP)

```
┌─────────────────────────────────────────────────────────────┐
│                   Visitor / Customer                         │
└──────────┬──────────────────────────────────────┬────────────┘
           │                                      │
           ▼ (HTTP/HTTPS)                        ▼
   ┌──────────────────┐              ┌──────────────────────┐
   │  PUBLIC WEB       │              │  SHOP STOREFRONT     │
   │  galantesjewelry  │              │  shop.galantes...    │
   │      .com         │              │       .com           │
   └────────┬─────────┘              └──────────┬───────────┘
            │                                    │
            │                                    │
        ┌───▼────────────────────────────────────▼───┐
        │                                             │
        │   DOCKER ORCHESTRATION (docker-compose)    │
        │                                             │
        ├──────────────────┬──────────────────────────┤
        │                  │                          │
        │  NEXT.JS WEB     │  ODOO STACK              │
        │  (port 3000)     │  (port 8069/8072)        │
        │                  │                          │
        │  • Hero/Branding │  • Product Catalog       │
        │  • Editorial     │  • Inventory/Stock       │
        │  • Admin Panel   │  • Order Management      │
        │  • Appointments  │  • Checkout              │
        │  • Contact CMS   │  • Shipping              │
        │                  │  • Fulfillment           │
        ├──────────────────┴──────────────────────────┤
        │                                             │
        │     NGINX GATEWAY (port 80/443)             │
        │     (proxy routing by domain)               │
        │                                             │
        ├──────────────────┬──────────────────────────┤
        │                  │                          │
        │   PostgreSQL     │  PostgreSQL (Odoo)       │
        │   (CMS/Auth)     │  or SQLite (dev)         │
        │                  │                          │
        └──────────────────┴──────────────────────────┘
            │
            ▼ (optional)
        ┌──────────────────┐
        │ Cloudflare Tunnel│
        │  (CF_TUNNEL_TOKEN)│
        └──────────────────┘
```

## Domain Routing Rules

| Domain | Service | Port | Proxy |
|--------|---------|------|-------|
| `galantesjewelry.com` | Next.js Web | 3000 | nginx →3000 |
| `shop.galantesjewelry.com` | Odoo Website | 8069 | nginx →8069 |
| `odoo.galantesjewelry.com` | Odoo Backend | 8072 | nginx →8072 |

**Nginx** routes all three via hostname matching in `infra/nginx/conf.d/galantes.conf`.

## Data Flow

### Product Discovery
1. User visits `galantesjewelry.com` → Next.js editorial homepage
2. Optional: Collections page can show curated links to shop
3. User clicks "Shop" → directed to `shop.galantesjewelry.com`
4. Shop page renders Odoo storefront (native Odoo Website module)

### Checkout
1. User adds items to Odoo cart
2. User clicks "Checkout" → Odoo payment gateway (Stripe/PayPal/etc.)
3. Order created in Odoo
4. Odoo fulfills + ships

### Admin / Inventory
1. Admins log into `odoo.galantesjewelry.com` → Odoo ERP backend
2. Manage products, pricing, stock, orders
3. Create shipments, process returns
4. View analytics

### Integrations (Post-MVP)
- **Meta/Facebook/Instagram**: Sync product catalog from Odoo to Meta Catalog (daily or on-demand)
- **WhatsApp**: Send product catalogs and take inquiries via WhatsApp Business API
- **Email**: Transactional emails from Odoo (order confirmation, shipping) or custom SMTP relay

## Technical Contracts

### Integration Contract: Shop Product (v1)
**File**: `integration-contracts/shop-product.v1.ts`

Defines the minimal product schema that Odoo exports and frontend consumes:
```ts
type ShopProduct = {
  id: string;
  slug: string;
  name: string;
  shortDescription?: string;
  longDescription?: string;
  price: number;
  currency: string;
  availability: 'in_stock' | 'out_of_stock' | 'preorder';
  imageUrl?: string;
  gallery?: string[];
  sku?: string;
  material?: string;
  category?: string;
  buyUrl: string; // → shop.galantesjewelry.com/product/<slug>
  publicUrl?: string; // SEO-friendly URL on Odoo Website
}
```

### Integration Contract: Publication Flow (v1)
**File**: `integration-contracts/publication-flow.v1.md`

Defines when/how products are marked "published" in Odoo and synced to external channels:
- What metadata is required for Meta (dimensions, material, origin country)
- Which product status means "publishable" (e.g., `available_on_website=True`)
- Trigger: manual sync endpoint vs. automatic webhook
- Frequency: MVP = daily cron, production = real-time if scale warrants

## API Boundaries

| Direction | Source | Target | Protocol | Purpose |
|-----------|--------|--------|----------|---------|
| Read | WS-C (Frontend) | Odoo API | REST/RPC | Fetch product list, details |
| Sync | WS-D (Meta) | Odoo API | REST/RPC | Read products for Meta Catalog |
| Sync | WS-D (Meta) | Meta API | REST | Post product metadata |
| Admin | Admin | Odoo Backend | HTTP | Manage inventory, orders |
| Content | WS-C (Frontend) | Next.js CMS | Local/JSON | Editorial pages, branding |

## Reuse & Non-Goals

### Reuse
- Current Next.js site (editorial + admin panel)
- Existing CMS (data/cms.json) for branding/content
- Docker + Nginx orchestration
- Cloudflare tunnel (if configured)
- JWT auth pattern (jose)

### Non-Goals (MVP)
- Rewrite current Next.js pages
- Migrate editorial content to Odoo
- Omnichannel inventory sync beyond catalog
- Custom checkout UI in Next.js
- Real-time inventory sync (daily cron acceptable)
- Marketplace / multi-vendor
- Advanced fulfillment rules

---

## Success Criteria
- ✓ User can visit `galantesjewelry.com` and see current site (no regression)
- ✓ User can navigate to `shop.galantesjewelry.com` and see Odoo storefront
- ✓ User can add items to cart and checkout via Odoo
- ✓ Admin can manage inventory at `odoo.galantesjewelry.com`
- ✓ 3 domains routed correctly via Nginx
- ✓ All env vars in `.env.example`
- ✓ Docker runs all services with `docker-compose up`
