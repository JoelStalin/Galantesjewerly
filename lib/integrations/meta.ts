/**
 * Meta Catalog Integration
 *
 * Syncs product catalog from Odoo to Meta (Facebook, Instagram, WhatsApp).
 * Implements integration-contracts/publication-flow.v1.md.
 *
 * Reference:
 *   - Meta Product Catalog API: https://developers.facebook.com/docs/marketing-api/catalog
 *   - Supported fields: https://developers.facebook.com/docs/marketing-api/catalog/fields
 */

import { ShopProduct } from '@/lib/odoo/client';

export interface MetaProductPayload {
  id?: string;
  sku?: string;
  name: string;
  description: string;
  price: string;
  currency: string;
  image_url: string;
  url: string;
  availability: 'in stock' | 'out of stock' | 'preorder';
  brand?: string;
  category_name?: string;
  material?: string;
  additional_image_urls?: string[];
}

export interface MetaSyncResult {
  success: number;
  failed: number;
  errors: Array<{
    productId: string;
    productName: string;
    error: string;
  }>;
  timestamp: string;
}

class MetaCatalogClient {
  private accessToken: string;
  private catalogId: string;
  private appId: string;
  private timeout: number;
  private dryRun: boolean;

  constructor(
    accessToken: string,
    catalogId: string,
    appId: string,
    dryRun: boolean = false,
  ) {
    this.accessToken = accessToken;
    this.catalogId = catalogId;
    this.appId = appId;
    this.dryRun = dryRun;
    this.timeout = 10000;

    if (!accessToken || !catalogId || !appId) {
      throw new Error(
        'Meta integration requires: META_ACCESS_TOKEN, META_CATALOG_ID, META_APP_ID',
      );
    }
  }

  /**
   * Transform Odoo ShopProduct to Meta Product format
   */
  private transformToMetaProduct(product: ShopProduct): MetaProductPayload {
    return {
      sku: product.sku || `${product.id}`,
      name: product.name.substring(0, 100), // Meta limit
      description: (product.longDescription || product.shortDescription || '')
        .substring(0, 5000), // Meta limit
      price: product.price.toFixed(2),
      currency: product.currency || 'USD',
      image_url: product.imageUrl || '',
      url: product.publicUrl || product.buyUrl,
      availability: this.mapAvailability(product.availability),
      brand: "Galante's Jewelry",
      category_name: product.category || 'Jewelry',
      material: product.material || undefined,
      additional_image_urls: product.gallery && product.gallery.length > 0 ? product.gallery : undefined,
    };
  }

  /**
   * Map Odoo availability to Meta format
   */
  private mapAvailability(
    availability: 'in_stock' | 'out_of_stock' | 'preorder',
  ): 'in stock' | 'out of stock' | 'preorder' {
    // Meta expects lowercase with space
    switch (availability) {
      case 'in_stock':
        return 'in stock';
      case 'out_of_stock':
        return 'out of stock';
      case 'preorder':
        return 'preorder';
      default:
        return 'in stock';
    }
  }

  /**
   * Validate product has all required Meta fields
   */
  private validateProduct(product: MetaProductPayload): string | null {
    if (!product.name) return 'Product name is required';
    if (!product.price) return 'Product price is required';
    if (!product.currency) return 'Product currency is required';
    if (!product.image_url) return 'Product image URL is required';
    if (!product.url) return 'Product URL is required';

    // Image URL must be HTTPS
    if (!product.image_url.startsWith('https://')) {
      return 'Product image URL must use HTTPS';
    }

    return null;
  }

  /**
   * Sync a single product to Meta Catalog
   */
  async syncProduct(
    product: ShopProduct,
  ): Promise<{ success: boolean; error?: string }> {
    if (this.dryRun) {
      console.log('[DRY RUN] Would sync product:', product.name);
      return { success: true };
    }

    try {
      const metaProduct = this.transformToMetaProduct(product);
      const validationError = this.validateProduct(metaProduct);

      if (validationError) {
        return { success: false, error: validationError };
      }

      // Meta Product Catalog API endpoint
      const endpoint = `https://graph.facebook.com/v19.0/${this.catalogId}/products`;

      const payload = {
        ...metaProduct,
        retailer_id: product.sku || product.id,
      };

      const response = await this.fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...payload,
          access_token: this.accessToken,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        const errorMsg =
          error.error?.message ||
          `Meta API error: ${response.status} ${response.statusText}`;
        return { success: false, error: errorMsg };
      }

      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Sync all products to Meta Catalog
   */
  async syncAllProducts(products: ShopProduct[]): Promise<MetaSyncResult> {
    const result: MetaSyncResult = {
      success: 0,
      failed: 0,
      errors: [],
      timestamp: new Date().toISOString(),
    };

    for (const product of products) {
      const syncResult = await this.syncProduct(product);

      if (syncResult.success) {
        result.success++;
      } else {
        result.failed++;
        result.errors.push({
          productId: product.id,
          productName: product.name,
          error: syncResult.error || 'Unknown error',
        });
      }

      // Rate limiting: slight delay between requests
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return result;
  }

  /**
   * Delete product from Meta Catalog
   */
  async deleteProduct(productId: string): Promise<{ success: boolean; error?: string }> {
    if (this.dryRun) {
      console.log('[DRY RUN] Would delete product:', productId);
      return { success: true };
    }

    try {
      const endpoint = `https://graph.facebook.com/v19.0/${productId}`;

      const response = await this.fetchWithTimeout(endpoint, {
        method: 'DELETE',
        body: new URLSearchParams({
          access_token: this.accessToken,
        }).toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        const errorMsg =
          error.error?.message ||
          `Meta API error: ${response.status} ${response.statusText}`;
        return { success: false, error: errorMsg };
      }

      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Get catalog status & stats
   */
  async getCatalogStats(): Promise<{
    productCount?: number;
    lastUpdated?: string;
    error?: string;
  }> {
    if (this.dryRun) {
      return { productCount: 0, lastUpdated: new Date().toISOString() };
    }

    try {
      const endpoint = `https://graph.facebook.com/v19.0/${this.catalogId}`;
      const response = await this.fetchWithTimeout(endpoint, {
        method: 'GET',
        body: new URLSearchParams({
          access_token: this.accessToken,
          fields: 'name,product_count,updated_time',
        }).toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (!response.ok) {
        return { error: `Meta API error: ${response.status}` };
      }

      const data = await response.json();
      return {
        productCount: data.product_count,
        lastUpdated: data.updated_time,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { error: errorMsg };
    }
  }

  /**
   * Internal: Fetch with timeout
   */
  private async fetchWithTimeout(
    url: string,
    init?: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      return await fetch(url, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Factory function to create Meta client from env vars
 */
export function createMetaClient(dryRun: boolean = false): MetaCatalogClient {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const catalogId = process.env.META_CATALOG_ID;
  const appId = process.env.META_APP_ID;

  if (!accessToken || !catalogId || !appId) {
    throw new Error(
      'Meta integration requires: META_ACCESS_TOKEN, META_CATALOG_ID, META_APP_ID environment variables',
    );
  }

  return new MetaCatalogClient(accessToken, catalogId, appId, dryRun);
}

export default MetaCatalogClient;
