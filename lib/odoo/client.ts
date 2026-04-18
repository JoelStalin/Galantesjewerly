/**
 * Odoo API Client
 *
 * Provides typed access to Galante's Jewelry product catalog via Odoo REST API.
 * Follows integration-contracts/shop-product.v1.ts schema.
 *
 * Usage:
 *   const client = getOdooClient();
 *   const products = await client.getProducts({ q: 'ring', sort: 'featured', page: 1 });
 *   const product  = await client.getProductBySlug('engagement-ring-14k-gold');
 *   const related  = await client.getRelatedProducts('engagement-ring-14k-gold', 4);
 *   const cats     = await client.getCategories();
 */

// ---------------------------------------------------------------------------
// Shared types (exported for use across the storefront)
// ---------------------------------------------------------------------------

export type ShopProduct = {
  /** Odoo product.template.id */
  id: string;
  /** URL-friendly slug used in /shop/<slug> */
  slug: string;
  name: string;
  /** One-line value proposition (product cards) */
  tagline?: string;
  /** 1–3 sentence sales copy (cards + listing previews) */
  shortDescription?: string;
  /** Full customer-facing copy (detail page) */
  longDescription?: string;
  /** Specifications: metal, stone, dimensions, etc. */
  productDetails?: string;
  /** Care instructions, shipping notes, packaging */
  careAndShipping?: string;
  price: number;
  currency: string;
  availability: 'in_stock' | 'out_of_stock' | 'preorder';
  imageUrl?: string;
  gallery?: string[];
  sku?: string;
  /** Human-readable material label (e.g. '14K Gold') */
  material?: string;
  /** Raw material code for filtering (e.g. 'gold_14k') */
  materialCode?: string;
  category?: string;
  categoryId?: number | null;
  buyUrl: string;
  publicUrl?: string;
  isFeatured?: boolean;
};

export type CategoryData = {
  id: number;
  name: string;
  /** URL-friendly version of name */
  slug: string;
  /** Number of published products in this category */
  count: number;
  parentId?: number | null;
};

/** Combined search/filter/sort/pagination query for getProducts() */
export type ShopQuery = {
  /** Full-text search: name, tagline, short description, SKU */
  q?: string;
  category?: string;
  material?: string;
  sort?: 'featured' | 'newest' | 'price_asc' | 'price_desc' | 'alphabetical';
  min_price?: number;
  max_price?: number;
  page?: number;
  page_size?: number;
};

export type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

export interface OdooClientConfig {
  baseUrl?: string;
  timeout?: number;
  cacheTTL?: number;
}

// ---------------------------------------------------------------------------
// OdooClient class
// ---------------------------------------------------------------------------

class OdooClient {
  private baseUrl: string;
  private timeout: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private cache: Map<string, { data: any; timestamp: number }>;
  private cacheTTL: number;

  constructor(config: OdooClientConfig = {}) {
    this.baseUrl =
      config.baseUrl || process.env.ODOO_BASE_URL || 'http://localhost:8069';
    this.timeout = config.timeout || 10000;
    this.cache = new Map();
    this.cacheTTL = config.cacheTTL || 5 * 60 * 1000; // 5 minutes
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Fetch a paginated, filtered, and sorted product list.
   *
   * Accepts either a ShopQuery object (new) or legacy (page, pageSize) numbers.
   */
  async getProducts(
    queryOrPage: ShopQuery | number = 1,
    legacyPageSize: number = 24,
  ): Promise<PaginatedResponse<ShopProduct>> {
    const params = this._buildProductParams(queryOrPage, legacyPageSize);
    const cacheKey = `products-${JSON.stringify(params)}`;

    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey)!.data;
    }

    try {
      const response = await this.fetch('/api/products', { query: params });
      // Normalise pagination: API may not have hasNext/hasPrev on older builds
      if (response.pagination && response.pagination.hasNext === undefined) {
        const p = response.pagination;
        p.hasNext = p.page < p.pages;
        p.hasPrev = p.page > 1;
        p.pages = p.pages || Math.max(1, Math.ceil(p.total / p.pageSize));
      }
      this.cache.set(cacheKey, { data: response, timestamp: Date.now() });
      return response;
    } catch (error) {
      console.error('Failed to fetch products:', error);
      throw new Error('Unable to load products. Please try again later.');
    }
  }

  /** Fetch a single product by its URL slug. */
  async getProductBySlug(slug: string): Promise<ShopProduct | null> {
    const cacheKey = `product-${slug}`;

    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey)!.data;
    }

    try {
      const response = await this.fetch(`/api/products/${slug}`);
      if (!response.data) return null;
      this.cache.set(cacheKey, { data: response.data, timestamp: Date.now() });
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch product ${slug}:`, error);
      return null;
    }
  }

  /** Fetch related products for the detail page (by slug). */
  async getRelatedProducts(
    slug: string,
    limit: number = 4,
  ): Promise<ShopProduct[]> {
    const cacheKey = `related-${slug}-${limit}`;

    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey)!.data;
    }

    try {
      const response = await this.fetch(`/api/products/${slug}/related`, {
        query: { limit },
      });
      const data = response.data || [];
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      console.error(`Failed to fetch related products for ${slug}:`, error);
      return [];
    }
  }

  /** Fetch all categories that have at least one published product. */
  async getCategories(): Promise<CategoryData[]> {
    const cacheKey = 'categories';

    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey)!.data;
    }

    try {
      const response = await this.fetch('/api/categories');
      const data: CategoryData[] = response.data || [];
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      return [];
    }
  }

  /** Featured products for homepage / collections block. */
  async getFeaturedProducts(limit: number = 6): Promise<ShopProduct[]> {
    const cacheKey = `featured-${limit}`;

    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey)!.data;
    }

    try {
      const response = await this.fetch('/api/products/featured', {
        query: { limit },
      });
      const data = response.data || [];
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      console.error('Failed to fetch featured products:', error);
      return [];
    }
  }

  /**
   * Fetch products by category (legacy helper – prefer getProducts({ category })).
   * @deprecated Use getProducts({ category, page, page_size }) instead.
   */
  async getProductsByCategory(
    category: string,
    page: number = 1,
    pageSize: number = 24,
  ): Promise<PaginatedResponse<ShopProduct>> {
    return this.getProducts({ category, page, page_size: pageSize });
  }

  clearCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /** Build the query-param object accepted by /api/products. */
  private _buildProductParams(
    queryOrPage: ShopQuery | number,
    legacyPageSize: number,
  ): Record<string, string | number> {
    if (typeof queryOrPage === 'number') {
      return { page: queryOrPage, page_size: legacyPageSize };
    }

    const q = queryOrPage;
    const params: Record<string, string | number> = {
      page: q.page ?? 1,
      page_size: q.page_size ?? legacyPageSize,
    };

    if (q.q)         params.q         = q.q;
    if (q.category)  params.category  = q.category;
    if (q.material)  params.material  = q.material;
    if (q.sort)      params.sort      = q.sort;
    if (q.min_price != null) params.min_price = q.min_price;
    if (q.max_price != null) params.max_price = q.max_price;

    return params;
  }

  private async fetch(
    endpoint: string,
    options: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      query?: Record<string, any>;
      headers?: Record<string, string>;
    } = {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    const url = new URL(endpoint, this.baseUrl);

    if (options.query) {
      Object.entries(options.query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Odoo API error: ${response.status} ${response.statusText}`);
      }

      return response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private isCacheValid(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    return Date.now() - entry.timestamp < this.cacheTTL;
  }
}

// ---------------------------------------------------------------------------
// Singleton factory
// ---------------------------------------------------------------------------

let clientInstance: OdooClient | null = null;

/** @deprecated Use getOdooClient() */
export function createOdooClient(config?: OdooClientConfig): OdooClient {
  if (!clientInstance) clientInstance = new OdooClient(config);
  return clientInstance;
}

export function getOdooClient(): OdooClient {
  if (!clientInstance) clientInstance = new OdooClient();
  return clientInstance;
}

export default OdooClient;
