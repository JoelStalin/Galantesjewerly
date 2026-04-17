/**
 * Shop Product Contract v1
 *
 * Defines the minimal product schema exported from Odoo and consumed by:
 * - WS-C (Frontend): product list & detail pages
 * - WS-D (Meta): catalog sync
 *
 * Source: Odoo product.template (galantes_jewelry addon)
 * Export: REST API endpoint: GET /api/products, GET /api/products/:slug
 */

export type ShopProduct = {
  /** Unique product identifier (Odoo product.template.id) */
  id: string;

  /** URL-friendly slug, auto-generated from name (e.g., "engagement-ring-14k-gold") */
  slug: string;

  /** Product name as entered in Odoo */
  name: string;

  /** Short description (140–180 chars), used in product cards & Meta */
  shortDescription?: string;

  /** Full product description, used in detail pages & Meta */
  longDescription?: string;

  /** Sale price (list_price in Odoo) */
  price: number;

  /** Currency code (e.g., "USD", from company_id.currency_id.name) */
  currency: string;

  /** Stock availability status */
  availability: 'in_stock' | 'out_of_stock' | 'preorder';

  /** Primary product image URL (1:1 aspect ratio, 1024px minimum) */
  imageUrl?: string;

  /** Array of additional gallery image URLs (from galantes.product.gallery) */
  gallery?: string[];

  /** SKU code (default_code) for inventory systems */
  sku?: string;

  /** Material type (e.g., "gold", "silver", "platinum") */
  material?: string;

  /** Product category (e.g., "bridal", "rings", "nautical") */
  category?: string;

  /** Direct purchase URL pointing to shop.galantesjewelry.com/product/:slug */
  buyUrl: string;

  /** Canonical URL for SEO (shop.galantesjewelry.com/products/:slug) */
  publicUrl?: string;
};

/**
 * API Response Format
 *
 * List endpoint (GET /api/products):
 * {
 *   data: ShopProduct[],
 *   pagination: {
 *     page: number,
 *     pageSize: number,
 *     total: number
 *   }
 * }
 *
 * Detail endpoint (GET /api/products/:slug):
 * {
 *   data: ShopProduct
 * }
 */

/**
 * Contract Versioning
 *
 * v1 (current):
 *  - Initial release: base product fields for shop and Meta
 *  - No breaking changes expected until new field categories emerge
 *
 * Future breaking changes would increment to v2:
 *  - Removing or renaming required fields
 *  - Changing data types
 *  - Restructuring nested objects
 *
 * Non-breaking additions (e.g., new optional fields) remain v1.
 */
