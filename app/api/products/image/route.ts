import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';

function toBinaryBody(buffer: Buffer) {
  return new Uint8Array(buffer);
}

async function fallbackImageResponse(status = 200) {
  const candidatePaths = [
    path.join(process.cwd(), 'public', 'assets', 'images', 'odoo-placeholder.png'),
    path.join(process.cwd(), '..', 'public', 'assets', 'images', 'odoo-placeholder.png'),
    '/app/public/assets/images/odoo-placeholder.png',
  ];

  let fallbackPath = '';
  for (const p of candidatePaths) {
    if (existsSync(p)) {
      fallbackPath = p;
      break;
    }
  }

  if (!fallbackPath) {
    console.warn('[ProductImage] odoo-placeholder.png not found, returning 404');
    return new NextResponse('Product image placeholder not found', { status: 404 });
  }

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawId = searchParams.get('id');
  const productId = Number.parseInt(rawId || '', 10);

  if (!Number.isFinite(productId) || productId <= 0) {
    return fallbackImageResponse(200);
  }

  const odooBaseUrl = (process.env.ODOO_BASE_URL || 'http://odoo:8069').replace(/\/+$/, '');

  // Fetch direct public web/image endpoint from Odoo backend
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

      // Verify it is a real product image (Odoo default 1x1 placeholder is < 500 bytes)
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

  // Fallback to clean product placeholder (never logo)
  return fallbackImageResponse(200);
}
