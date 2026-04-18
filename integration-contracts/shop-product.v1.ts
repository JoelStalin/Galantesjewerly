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

  /** One-line value proposition shown on product cards (max ~100 chars) */
  tagline?: string;

  /** Short description (1–3 sentences), used in product cards & Meta */
  shortDescription?: string;

  /** Full product description, used in detail pages */
  longDescription?: string;

  /** Key specifications: metal, stone, dimensions, finish, etc. */
  productDetails?: string;

  /** Care instructions, shipping notes, and packaging details */
  careAndShipping?: string;

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

  /** Human-readable material label (e.g. "14K Gold") */
  material?: string;

  /** Raw material code for filter queries (e.g. "gold_14k") */
  materialCode?: string;

  /** Product category name */
  category?: string;

  /** Product category ID */
  categoryId?: number | null;

  /** Direct purchase URL pointing to shop.galantesjewelry.com/shop/:slug */
  buyUrl: string;

  /** Canonical URL for SEO (same as buyUrl in current implementation) */
  publicUrl?: string;

  /** Whether the product is pinned to featured sections */
  isFeatured?: boolean;
};

export type CategoryData = {
  /** Odoo product.category.id */
  id: number;
  /** Category display name */
  name: string;
  /** URL-friendly slug derived from name */
  slug: string;
  /** Number of published products in this category */
  count: number;
  /** Parent category ID (null for top-level) */
  parentId?: number | null;
};

/**
 * API Response Format
 *
 * List endpoint (GET /api/products):
 * {
 *   success: true,
 *   data: ShopProduct[],
 *   pagination: {
 *     page: number,
 *     pageSize: number,
 *     total: number,
 *     pages: number,
 *     hasNext: boolean,
 *     hasPrev: boolean
 *   }
 * }
 *
 * Detail endpoint (GET /api/products/:slug):
 * { success: true, data: ShopProduct }
 *
 * Related endpoint (GET /api/products/:slug/related):
 * { success: true, data: ShopProduct[] }
 *
 * Categories endpoint (GET /api/categories):
 * { success: true, data: CategoryData[] }
 */

/**
 * Contract Versioning
 *
 * v1 (current):
 *  - Initial release: base product fields for shop and Meta
 *  - v1.1: Added tagline, productDetails, careAndShipping, materialCode,
 *           categoryId, isFeatured; pagination extended with pages/hasNext/hasPrev
 *
 * Future breaking changes would increment to v2:
 *  - Removing or renaming required fields
 *  - Changing data types
 *  - Restructuring nested objects
 *
 * Non-breaking additions (e.g., new optional fields) remain v1.
 */
