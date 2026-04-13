/**
 * Odoo API Client
 *
 * Provides typed access to Galante's Jewelry product catalog via Odoo REST API.
 * Follows integration-contracts/shop-product.v1.ts schema.
 *
 * Usage:
 *   const client = createOdooClient();
 *   const products = await client.getProducts();
 *   const product = await client.getProductBySlug('engagement-ring-14k-gold');
 */

export type ShopProduct = {
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
  buyUrl: string;
  publicUrl?: string;
};

export type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
};

export interface OdooClientConfig {
  baseUrl?: string;
  timeout?: number;
  cache?: boolean;
  cacheTTL?: number;
}

class OdooClient {
  private baseUrl: string;
  private timeout: number;
  private cache: Map<string, { data: any; timestamp: number }>;
  private cacheTTL: number; // in milliseconds

  constructor(config: OdooClientConfig = {}) {
    this.baseUrl =
      config.baseUrl || process.env.ODOO_BASE_URL || 'http://localhost:8069';
    this.timeout = config.timeout || 10000;
    this.cache = new Map();
    this.cacheTTL = config.cacheTTL || 5 * 60 * 1000; // 5 minutes default
  }

  /**
   * Fetch all published products
   */
  async getProducts(
    page: number = 1,
    pageSize: number = 20,
  ): Promise<PaginatedResponse<ShopProduct>> {
    const cacheKey = `products-${page}-${pageSize}`;

    // Check cache
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey)!.data;
    }

    try {
      const response = await this.fetch('/api/products', {
        query: { page, pageSize },
      });

      // Cache the result
      this.cache.set(cacheKey, {
        data: response,
        timestamp: Date.now(),
      });

      return response;
    } catch (error) {
      console.error('Failed to fetch products:', error);
      throw new Error('Unable to load products. Please try again later.');
    }
  }

  /**
   * Fetch product by slug
   */
  async getProductBySlug(slug: string): Promise<ShopProduct | null> {
    const cacheKey = `product-${slug}`;

    // Check cache
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey)!.data;
    }

    try {
      const response = await this.fetch(`/api/products/${slug}`);

      if (!response.data) {
        return null;
      }

      // Cache the result
      this.cache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now(),
      });

      return response.data;
    } catch (error) {
      console.error(`Failed to fetch product ${slug}:`, error);
      return null;
    }
  }

  /**
   * Fetch products by category
   */
  async getProductsByCategory(
    category: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<PaginatedResponse<ShopProduct>> {
    const cacheKey = `category-${category}-${page}-${pageSize}`;

    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey)!.data;
    }

    try {
      const response = await this.fetch('/api/products', {
        query: { category, page, pageSize },
      });

      this.cache.set(cacheKey, {
        data: response,
        timestamp: Date.now(),
      });

      return response;
    } catch (error) {
      console.error(`Failed to fetch category ${category}:`, error);
      throw new Error(
        `Unable to load products in category "${category}". Please try again later.`,
      );
    }
  }

  /**
   * Get featured/promoted products
   */
  async getFeaturedProducts(limit: number = 6): Promise<ShopProduct[]> {
    const cacheKey = `featured-${limit}`;

    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey)!.data;
    }

    try {
      const response = await this.fetch('/api/products/featured', {
        query: { limit },
      });

      this.cache.set(cacheKey, {
        data: response.data || [],
        timestamp: Date.now(),
      });

      return response.data || [];
    } catch (error) {
      console.error('Failed to fetch featured products:', error);
      return []; // Return empty array on error, don't block page
    }
  }

  /**
   * Clear cache for a specific key or all
   */
  clearCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Internal: Make HTTP request with timeout & error handling
   */
  private async fetch(
    endpoint: string,
    options: {
      query?: Record<string, any>;
      headers?: Record<string, string>;
    } = {},
  ): Promise<any> {
    const url = new URL(endpoint, this.baseUrl);

    // Add query parameters
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

  /**
   * Check if cache entry is still valid
   */
  private isCacheValid(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const age = Date.now() - entry.timestamp;
    return age < this.cacheTTL;
  }
}

/**
 * Create a singleton OdooClient instance
 */
let clientInstance: OdooClient | null = null;

export function createOdooClient(config?: OdooClientConfig): OdooClient {
  if (!clientInstance) {
    clientInstance = new OdooClient(config);
  }
  return clientInstance;
}

export function getOdooClient(): OdooClient {
  if (!clientInstance) {
    clientInstance = new OdooClient();
  }
  return clientInstance;
}

export default OdooClient;
