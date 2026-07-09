/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getGalleryImage: vi.fn(),
}));

vi.mock('@/lib/odoo/services', () => ({
  OdooService: {
    getGalleryImage: mocks.getGalleryImage,
  },
}));

describe('GET /api/products/gallery-image', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects path traversal input before touching Odoo or the filesystem', async () => {
    const { GET } = await import('@/app/api/products/gallery-image/route');
    const response = await GET(new Request('http://localhost/api/products/gallery-image?id=../../package'));

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toBe('Valid gallery image ID required');
    expect(mocks.getGalleryImage).not.toHaveBeenCalled();
  });

  it('rejects non-numeric ids before touching Odoo or the filesystem', async () => {
    const { GET } = await import('@/app/api/products/gallery-image/route');
    const response = await GET(new Request('http://localhost/api/products/gallery-image?id=abc'));

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toBe('Valid gallery image ID required');
    expect(mocks.getGalleryImage).not.toHaveBeenCalled();
  });

  it('returns a placeholder image for unknown valid gallery ids', async () => {
    mocks.getGalleryImage.mockResolvedValue(null);

    const { GET } = await import('@/app/api/products/gallery-image/route');
    const response = await GET(new Request('http://localhost/api/products/gallery-image?id=999'));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('image/svg+xml');
    expect(response.headers.get('x-cache')).toBe('MISS-PLACEHOLDER');
  });
});
