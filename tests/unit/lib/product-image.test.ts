import { describe, expect, it } from 'vitest';
import {
  PRODUCT_IMAGE_FALLBACK_SRC,
  getProductImageCandidates,
  getProductImageSrc,
} from '@/lib/product-image';

describe('getProductImageSrc', () => {
  it('prefers a stored image URL when present', () => {
    expect(getProductImageSrc({
      id: '24',
      product_id: 24,
      image_url: '/api/products/image?id=24',
    })).toBe('/api/products/image?id=24');
  });

  it('falls back to the product id when the image URL is missing', () => {
    expect(getProductImageSrc({
      id: 'cart-line-1',
      product_id: '24',
    })).toBe('/api/products/image?id=24&v=2');
  });

  it('returns the placeholder when no numeric id is available', () => {
    expect(getProductImageSrc({
      id: 'cart-line-1',
      product_id: 'bundle-alpha',
    })).toBe(PRODUCT_IMAGE_FALLBACK_SRC);
  });

  it('returns the local proxy as the first cart candidate when a numeric id exists', () => {
    expect(getProductImageCandidates({
      id: '31',
      product_id: 31,
      image_url: 'https://odoo.example.com/broken-image.png',
    })).toEqual([
      '/api/products/image?id=31&v=2',
      'https://odoo.example.com/broken-image.png',
      PRODUCT_IMAGE_FALLBACK_SRC,
    ]);
  });

  it('returns the stored image and placeholder when no numeric product id is available', () => {
    expect(getProductImageCandidates({
      id: 'bundle-alpha',
      product_id: 'bundle-alpha',
      image_url: 'https://cdn.example.com/image.png',
    })).toEqual([
      'https://cdn.example.com/image.png',
      PRODUCT_IMAGE_FALLBACK_SRC,
    ]);
  });
});
