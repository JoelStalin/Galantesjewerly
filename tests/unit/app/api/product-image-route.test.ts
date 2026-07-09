/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getProductImage: vi.fn(),
}));

vi.mock('@/lib/odoo/services', () => ({
  OdooService: {
    getProductImage: mocks.getProductImage,
  },
}));

describe('GET /api/products/image', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects path traversal input before touching Odoo or the filesystem', async () => {
    const { GET } = await import('@/app/api/products/image/route');
    const response = await GET(new Request('http://localhost/api/products/image?id=../../package'));

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toBe('Valid product ID required');
    expect(mocks.getProductImage).not.toHaveBeenCalled();
  });

  it('rejects non-numeric ids before touching Odoo or the filesystem', async () => {
    const { GET } = await import('@/app/api/products/image/route');
    const response = await GET(new Request('http://localhost/api/products/image?id=abc'));

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toBe('Valid product ID required');
    expect(mocks.getProductImage).not.toHaveBeenCalled();
  });

  it('returns the deterministic placeholder for unknown valid product ids', async () => {
    mocks.getProductImage.mockResolvedValue(null);

    const { GET } = await import('@/app/api/products/image/route');
    const response = await GET(new Request('http://localhost/api/products/image?id=999'));

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('image/svg+xml');
    expect(response.headers.get('X-Cache')).toBe('MISS-PLACEHOLDER');
    expect(mocks.getProductImage).toHaveBeenCalledWith(999);
  });
});
