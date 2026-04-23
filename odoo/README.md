# Odoo Backend — Galante's Jewelry

## Overview

Self-contained Odoo 17 instance with custom `galantes_jewelry` addon for managing:
- Product catalog (jewelry-specific fields: material, slug, web availability)
- Product gallery (multi-image support)
- Stock & pricing
- Order management
- Web publication (shop.galantesjewelry.com)

**Source of truth** for products, pricing, inventory, and customer orders.

---

## Quick Start

### Prerequisites
- Docker & Docker Compose
- ~2GB free disk space (postgres + odoo volumes)
- Environment variables set (see `.env` template)

### Launch

```bash
cd odoo
docker-compose up -d --build
```

Wait for both services to be healthy:
```bash
docker-compose ps
# Should show:
# galantes_odoo    running (healthy)
# galantes_db      running (healthy)
```

### Access

| Service | URL | Port |
|---------|-----|------|
| **Odoo Web** | `http://localhost:8069` | 8069 |
| **Odoo Backend (longpolling)** | `http://localhost:8072` | 8072 |
| **PostgreSQL** | `localhost:5432` | 5432 |

**Default login**: `admin` / `admin` (change in production!)

---

## First-Time Setup

### 1. Create Database & Install Modules

When Odoo first runs, it will auto-create `galantes_db`.

Via **Odoo UI** (recommended):
1. Go to `http://localhost:8069`
2. You'll see a "Create Database" form (first-time only)
3. Fill in:
   - Database name: `galantes_db`
   - Admin password: (create a secure password, **not** "admin")
   - Demo data: unchecked
4. Click "Create Database"

### 2. Install Required Modules

In Odoo > **Apps** search bar:

1. Search for `galantes_jewelry` → Install
   - This adds: custom product fields (material, slug, gallery), product categories, views

2. Search for `website_sale` → Install
   - This enables the web shop frontend (shop.galantesjewelry.com)

3. Search for `stock` → Install
   - For inventory management

### 3. Configure Website

In Odoo > **Website** > **Configuration**:

1. Set **Website Name**: "Galante's Jewelry Shop"
2. Set **Domain**: `shop.galantesjewelry.com` (must match `.env.example` SHOP_URL)
3. Enable **Shop** (eCommerce)

### 4. Create Sample Product

Test the addon:

1. Go to **Products** > **Products**
2. Click **Create**
3. Fill in:
   - **Name**: "Engagement Ring - 14K Gold"
   - **Category**: Bridal (or create)
   - **Material**: Gold
   - **Price**: 2499.00
   - **Image**: Upload a test image
   - **Available on Website**: ✓ (checked)
4. Save
   - Auto-generates slug: `engagement-ring-14k-gold`
   - Sets buyUrl: `https://shop.galantesjewelry.com/product/engagement-ring-14k-gold`

---

## Odoo Addon Structure

```
odoo/
├── addons/
│   └── galantes_jewelry/
│       ├── __manifest__.py          # Module metadata
│       ├── __init__.py               # Python module init
│       ├── models/
│       │   ├── __init__.py
│       │   ├── product_template.py   # Extended product fields
│       │   └── product_gallery.py    # Gallery images
│       ├── views/
│       │   ├── product_template_views.xml  # Form/tree/search views
│       │   └── product_gallery_views.xml
│       ├── data/
│       │   └── product_category.xml  # Pre-loaded categories
│       └── security/
│           └── ir.model.access.csv   # User permissions
├── config/
│   └── odoo.conf                    # Odoo server config
├── docker-compose.yml                # Service orchestration
├── Dockerfile                        # Odoo 17 + custom config
├── .env                              # Docker env vars (db credentials)
└── logs/                             # Odoo logs (auto-created)
```

---

## Key Models & Fields

### product.template (Extended)

| Field | Type | Purpose |
|-------|------|---------|
| `material` | Selection | Jewelry material (gold, silver, platinum, etc.) |
| `slug` | Char | URL-safe slug, auto-generated from name |
| `buy_url` | Char | Computed: `https://shop.galantesjewelry.com/product/{slug}` |
| `public_url` | Char | Computed: `https://shop.galantesjewelry.com/products/{slug}` |
| `available_on_website` | Boolean | Publish to shop? |
| `availability_status` | Selection | in_stock / out_of_stock / preorder (computed) |
| `gallery_ids` | One2many → galantes.product.gallery | Additional images |

### galantes.product.gallery (New)

| Field | Type | Purpose |
|-------|------|---------|
| `product_id` | Many2one | Related product |
| `image` | Image | Gallery photo (1024×1024 max) |
| `sequence` | Integer | Display order |
| `alt_text` | Char | SEO alt text |

---

## Integration Contracts

### Contract 1: `integration-contracts/shop-product.v1.ts`
Defines the product schema that **WS-C (Frontend)** and **WS-D (Meta)** consume.

Exported via API endpoint (future): `GET /api/products`

### Contract 2: `integration-contracts/publication-flow.v1.md`
Defines when products are published:
- `available_on_website = True` → syncs to shop
- Daily cron → syncs to Meta Catalog (if enabled)

---

## Environment Variables

See `odoo/.env`:

```env
POSTGRES_DB=galantes_db
POSTGRES_USER=odoo
POSTGRES_PASSWORD=CHANGE_ME_local_postgres_password
PGDATA=/var/lib/postgresql/data
ODOO_RC=/etc/odoo/odoo.conf
ODOO_ADDONS_PATH=/mnt/extra-addons
```

**For production**: Change `POSTGRES_PASSWORD` to a secure value, update `odoo.conf` `admin_passwd`.

---

## Exporting Data to Shop & Meta

### For Frontend (WS-C)

Create a REST API endpoint in Odoo or expose via [Odoo JSON-RPC](https://www.odoo.com/documentation/17.0/developer/reference/backend/orm.html#jsonrpc):

```python
# Example: GET /api/products (to be implemented in WS-B)
from odoo.http import request, route
from odoo.addons.web.controllers.main import Home

class ShopAPI(Home):
    @route('/api/products', auth='public', methods=['GET'])
    def get_products(self):
        products = request.env['product.template'].search([
            ('available_on_website', '=', True),
            ('active', '=', True)
        ])
        return {
            'data': [product._to_shop_product() for product in products]
        }

    @route('/api/products/<slug>', auth='public', methods=['GET'])
    def get_product(self, slug):
        product = request.env['product.template'].search([
            ('slug', '=', slug),
            ('available_on_website', '=', True)
        ], limit=1)
        return {'data': product._to_shop_product() if product else {}}
```

### For Meta (WS-D)

Sync endpoint (to be implemented in WS-D):
```python
# Example: POST /api/integrations/meta/sync
# Pulls products, validates for Meta schema, posts to Meta Catalog API
```

See `docs/meta-capabilities.md` and `integration-contracts/publication-flow.v1.md`.

---

## Development Notes

### Debugging

View logs:
```bash
docker-compose logs -f galantes_odoo
```

### Resetting Database

Destroy and rebuild:
```bash
docker-compose down -v
docker-compose up -d --build
# Then redo First-Time Setup
```

### Running Python Shell

```bash
docker-compose exec odoo odoo shell -d galantes_db
```

Then in Python:
```python
env['product.template'].search([('available_on_website', '=', True)])
```

---

## Production Deployment

### Before Going Live

1. **Change admin password**:
   - `odoo.conf`: set `admin_passwd` to a secure random string
   - Regenerate in `.env` for Docker

2. **Enable SSL**:
   - Use Nginx with Let's Encrypt (see `docs/deployment-notes.md`)
   - Set `proxy_mode = True` in `odoo.conf` (already set)

3. **Database Backups**:
   - Backup PostgreSQL volume daily
   - Test restore procedure

4. **Performance**:
   - Increase `workers` in `odoo.conf` (currently 2)
   - Use Redis for caching (optional, post-MVP)
   - Monitor database indexes

5. **Email**:
   - Configure `smtp_*` in `odoo.conf` for order notifications
   - Test SMTP connectivity

---

## Known Limitations (MVP)

- ✗ No real-time inventory sync to Meta (daily cron only)
- ✗ No custom checkout flow (use Odoo Website native)
- ✗ No omnichannel inventory aggregation (single source: Odoo)
- ✗ No API rate limiting (add if scale warrants)

---

## Support & Questions

For issues:
1. Check `docs/agent-state.md` → current phase & status
2. Check `docs/open-questions.md` → known Q's & blockers
3. Review Odoo logs: `docker-compose logs galantes_odoo`
4. Escalate to WS-A (Orchestrator) if outside scope

---

## References

- [Odoo 17 Documentation](https://www.odoo.com/documentation/17.0/)
- [Module Development Guide](https://www.odoo.com/documentation/17.0/developer/)
- Integration contracts: `integration-contracts/shop-product.v1.ts`, `integration-contracts/publication-flow.v1.md`
