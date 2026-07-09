/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createOdooClient } from '@/lib/odoo/client';

describe('Odoo client fallback catalog', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
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
});
