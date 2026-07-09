/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createOdooClient } from '@/lib/odoo/client';

describe('Odoo client fallback catalog', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    vi.unstubAllEnvs();
  });

  it('returns the demo pendant with a multi-image gallery when Odoo is unavailable', async () => {
    const client = createOdooClient({ cacheTTL: 0 });
    client.clearCache();

    const product = await client.getProductBySlug('shipping-calculation-demo-pendant');

    expect(product).not.toBeNull();
    expect(product?.slug).toBe('shipping-calculation-demo-pendant');
    expect(product?.gallery).toEqual([
      '/assets/products/compass-rose-pendant.png',
      '/assets/products/lighthouse-guardian-charm.png',
      '/assets/products/sirens-pearl-necklace.png',
    ]);
  });

  it('does not invent fallback products in production mode', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('GALANTES_ALLOW_FALLBACK_PRODUCTS', '0');

    const client = createOdooClient({ cacheTTL: 0 });
    client.clearCache();

    const product = await client.getProductBySlug('shipping-calculation-demo-pendant');
    const products = await client.getProducts({ page: 1, page_size: 10 });

    expect(product).toBeNull();
    expect(products.data).toEqual([]);
    expect(products.pagination.total).toBe(0);
  });
});
