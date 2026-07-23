import { existsSync } from 'fs';
import { readFile, readdir } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { createOdooClient, getOdooConfig } from '@/src/config/odooClient.js';

const FALLBACK_PRODUCT_IMAGE = path.join(process.cwd(), 'public', 'assets', 'images', 'odoo-placeholder.png');
const DRIVE_PRIMARY_DIR = path.join(process.cwd(), 'data', 'drive_inventory_20260722');

function toBinaryBody(buffer: Buffer) {
  return new Uint8Array(buffer);
}

async function fallbackImageResponse(status = 200) {
  const fallbackPath = existsSync(FALLBACK_PRODUCT_IMAGE)
    ? FALLBACK_PRODUCT_IMAGE
    : path.join(process.cwd(), 'public', 'assets', 'images', 'logo-square.png');
  const fileBuffer = await readFile(fallbackPath);

  return new NextResponse(toBinaryBody(fileBuffer), {
    status,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=300',
      'X-Galantes-Image-Fallback': 'product-placeholder',
    },
  });
}

async function driveImageResponse(productId: number) {
  // Production catalog currently exposes the 24 imported products as ids 138..161.
  // The Drive import stores four ordered photos per product; the first is the card image.
  const index = productId >= 138 && productId <= 161
      ? productId - 138
      : -1;
  if (index < 0 || index > 23) return null;
  try {
    const names = (await readdir(DRIVE_PRIMARY_DIR)).filter(x => x.endsWith('.jpg')).sort();
    const name = names[index * 4];
    if (!name) return null;
    const imageBuffer = await readFile(path.join(DRIVE_PRIMARY_DIR, name));
    return new NextResponse(toBinaryBody(imageBuffer), {
      headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400', 'X-Galantes-Image-Source': 'drive-import' },
    });
  } catch (error) {
    console.error('[ProductImage] Drive import image unavailable:', productId, error);
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawId = searchParams.get('id');
  const productId = Number.parseInt(rawId || '', 10);

  if (!Number.isFinite(productId) || productId <= 0) {
    return fallbackImageResponse(200);
  }

  const odooBaseUrl = (process.env.ODOO_BASE_URL || 'http://odoo:8069').replace(/\/+$/, '');

  // 1. Primary: Fetch direct public web/image endpoint from Odoo backend
  try {
    const odooImageUrl = `${odooBaseUrl}/web/image/product.template/${productId}/image_1920`;
    const res = await fetch(odooImageUrl, {
      headers: { 'User-Agent': 'galantes-jewelry-storefront/1.0' },
      next: { revalidate: 86400 },
    });

    if (res.ok) {
      const contentType = res.headers.get('content-type') || 'image/png';
      const arrayBuf = await res.arrayBuffer();
      const imageBuffer = Buffer.from(arrayBuf);

      // Verify it's a real product image (Odoo's default 1x1 placeholder is < 500 bytes)
      if (imageBuffer.length > 500 && contentType.startsWith('image/')) {
        return new NextResponse(toBinaryBody(imageBuffer), {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
            'X-Galantes-Image-Source': 'odoo-web-image',
          },
        });
      }
    }
  } catch (error) {
    console.warn('[ProductImage] Direct Odoo web/image fetch failed:', productId, error);
  }

  // 2. Secondary: Fallback to Drive import local images
  const driveResponse = await driveImageResponse(productId);
  if (driveResponse) return driveResponse;

  // 3. Fallback to clean product placeholder
  return fallbackImageResponse(200);
}
