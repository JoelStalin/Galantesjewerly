import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { createOdooClient } from '@/src/config/odooClient';

const CACHE_DIR = process.env.APP_DATA_DIR
  ? path.join(process.env.APP_DATA_DIR, 'blobs', 'product_gallery_images')
  : path.join(process.cwd(), 'data', 'blobs', 'product_gallery_images');
const PLACEHOLDER_PATH = path.join(process.cwd(), 'public', 'assets', 'products', 'product-placeholder.svg');
const client = createOdooClient();

function toBinaryBody(buffer: Buffer) {
  return new Uint8Array(buffer);
}

function detectMimeType(buffer: Buffer) {
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
    return 'image/jpeg';
  }
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buffer.subarray(0, 6).toString('ascii') === 'GIF87a' || buffer.subarray(0, 6).toString('ascii') === 'GIF89a') {
    return 'image/gif';
  }
  if (buffer.length > 12 && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }

  return 'application/octet-stream';
}

function parseGalleryImageId(value: string | null) {
  if (!value || !/^[1-9]\d{0,8}$/.test(value)) {
    return null;
  }

  const galleryId = Number(value);
  if (!Number.isSafeInteger(galleryId)) {
    return null;
  }

  return galleryId;
}

function buildCachePath(galleryId: number) {
  const cacheRoot = path.resolve(CACHE_DIR);
  const cachePath = path.resolve(cacheRoot, `${galleryId}.bin`);
  const relativePath = path.relative(cacheRoot, cachePath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('Resolved gallery image cache path escaped the cache directory.');
  }

  return cachePath;
}

async function readPlaceholderResponse(cacheTag: string) {
  const buffer = await fs.readFile(PLACEHOLDER_PATH);
  return new NextResponse(toBinaryBody(buffer), {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=43200',
      'X-Cache': cacheTag,
    },
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const galleryId = parseGalleryImageId(id);

  if (!galleryId) {
    return new Response('Valid gallery image ID required', { status: 400 });
  }

  const cachePath = buildCachePath(galleryId);

  try {
    if (existsSync(cachePath)) {
      const buffer = await fs.readFile(cachePath);
      if (buffer.byteLength > 9000) {
        return new NextResponse(toBinaryBody(buffer), {
          headers: {
            'Content-Type': detectMimeType(buffer),
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=43200',
            'X-Cache': 'HIT',
          },
        });
      }
    }

    const payload = await fetchGalleryImage(galleryId);
    if (!payload) {
      return await readPlaceholderResponse('MISS-PLACEHOLDER');
    }

    const buffer = Buffer.from(payload.base64, 'base64');

    try {
      if (!existsSync(CACHE_DIR)) {
        await fs.mkdir(CACHE_DIR, { recursive: true });
      }
      await fs.writeFile(cachePath, buffer);
    } catch (cacheError) {
      console.error('[GalleryImageProxy] Failed to write to cache:', cacheError);
    }

    return new NextResponse(toBinaryBody(buffer), {
      headers: {
        'Content-Type': payload.mimetype || detectMimeType(buffer),
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=43200',
        'X-Cache': 'MISS',
      },
    });
  } catch (error) {
    console.error('[GalleryImageProxy] Error fetching image:', error);
    return await readPlaceholderResponse('ERROR-PLACEHOLDER');
  }
}

async function fetchGalleryImage(galleryId: number) {
  let baseUrl = process.env.ODOO_BASE_URL || 'http://odoo:8069';
  if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
    baseUrl = baseUrl.replace('localhost', 'odoo').replace('127.0.0.1', 'odoo');
  }

  const directRoute = `${baseUrl}/api/products/gallery-image/${galleryId}`;

  try {
    const response = await fetch(directRoute, {
      next: { revalidate: 3600 },
    });

    if (response.ok) {
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > 9000) {
        return {
          base64: Buffer.from(buffer).toString('base64'),
          mimetype: response.headers.get('content-type') || 'image/webp',
        };
      }
    }
  } catch {
    // Fall through to API read fallback.
  }

  try {
    const result = await client.call('galantes.product.gallery', 'read', {
      ids: [galleryId],
      fields: ['image'],
    }) as Array<{ image?: string | null }>;

    const image = result[0]?.image;
    if (!image || image.length <= 12000) {
      return null;
    }

    return {
      base64: image,
      mimetype: null,
    };
  } catch (error) {
    console.error(`[GalleryImageProxy] Odoo fallback failed for ${galleryId}:`, error);
    return null;
  }
}
