import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { createOdooClient, getOdooConfig } from '@/src/config/odooClient.js';

const FALLBACK_PRODUCT_IMAGE = path.join(process.cwd(), 'public', 'assets', 'images', 'logo-square.png');

function toBinaryBody(buffer: Buffer) {
  return new Uint8Array(buffer);
}

async function fallbackImageResponse(status = 200) {
  const fallbackPath = existsSync(FALLBACK_PRODUCT_IMAGE)
    ? FALLBACK_PRODUCT_IMAGE
    : path.join(process.cwd(), 'public', 'assets', 'branding', 'logo.png');
  const fileBuffer = await readFile(fallbackPath);

  return new NextResponse(toBinaryBody(fileBuffer), {
    status,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=300',
      'X-Galantes-Image-Fallback': 'gallery',
    },
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawId = searchParams.get('id');
  const imageId = Number.parseInt(rawId || '', 10);

  if (!Number.isFinite(imageId) || imageId <= 0) {
    return fallbackImageResponse(200);
  }

  const config = getOdooConfig();
  if (!config.isReady) {
    return fallbackImageResponse(200);
  }

  try {
    const odoo = createOdooClient(config);
    const records = await odoo.searchRead('product.image', {
      domain: [['id', '=', imageId]],
      fields: ['id', 'image_1920', 'write_date'],
      limit: 1,
    }) as Array<{ image_1920?: string | false | null; write_date?: string }>;

    const imageBase64 = records[0]?.image_1920;
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return fallbackImageResponse(200);
    }

    const imageBuffer = Buffer.from(imageBase64, 'base64');
    if (imageBuffer.length === 0) {
      return fallbackImageResponse(200);
    }

    return new NextResponse(toBinaryBody(imageBuffer), {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        ETag: `"gallery-${imageId}-${records[0]?.write_date || imageBuffer.length}"`,
      },
    });
  } catch (error) {
    console.error('[ProductGalleryImage] Failed to load gallery image from Odoo:', imageId, error);
    return fallbackImageResponse(200);
  }
}
