import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { OdooService } from '@/lib/odoo/services';

const CACHE_DIR = process.env.APP_DATA_DIR
  ? path.join(process.env.APP_DATA_DIR, 'blobs', 'product_images')
  : path.join(process.cwd(), 'data', 'blobs', 'product_images');
const PLACEHOLDER_PATH = path.join(process.cwd(), 'public', 'assets', 'products', 'product-placeholder.svg');
const LOCAL_FALLBACK_IMAGES: Record<string, string> = {
  '1': 'the-islamorada-solitaire.png',
  '2': 'mariners-bond-band.png',
  '3': 'compass-rose-pendant.png',
  '4': 'keys-azure-drop-earrings.png',
  '5': 'anchor-soul-bracelet.png',
  '6': 'coastal-tide-ring.png',
  '7': 'sirens-pearl-necklace.png',
  '8': 'navigators-chrono-link.png',
  '9': 'tritons-trident-tie-bar.png',
  '10': 'lighthouse-guardian-charm.png',
};

function toBinaryBody(buffer: Buffer) {
  return new Uint8Array(buffer);
}

function parseProductTemplateId(value: string | null) {
  if (!value || !/^[1-9]\d{0,8}$/.test(value)) {
    return null;
  }

  const templateId = Number(value);
  if (!Number.isSafeInteger(templateId)) {
    return null;
  }

  return templateId;
}

function buildCachePath(templateId: number) {
  const cacheRoot = path.resolve(CACHE_DIR);
  const cachePath = path.resolve(cacheRoot, `${templateId}.png`);
  const relativePath = path.relative(cacheRoot, cachePath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('Resolved product image cache path escaped the cache directory.');
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
  const templateId = parseProductTemplateId(id);

  if (!templateId) {
    return new Response('Valid product ID required', { status: 400 });
  }

  const cachePath = buildCachePath(templateId);

  try {
    if (existsSync(cachePath)) {
      const buffer = await fs.readFile(cachePath);
      if (buffer.byteLength > 9000) {
        return new NextResponse(toBinaryBody(buffer), {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=43200',
            'X-Cache': 'HIT',
          },
        });
      }
      console.warn(`[ProductImageProxy] Cached image for ID ${templateId} is too small (${buffer.byteLength} bytes), re-fetching...`);
    }

    const base64Image = await OdooService.getProductImage(templateId);

    if (!base64Image) {
      console.warn(`[ProductImageProxy] Image for ID ${templateId} not found in Odoo, attempting local fallback...`);
      const fileName = LOCAL_FALLBACK_IMAGES[String(templateId)];
      if (fileName) {
        const localPath = path.join(process.cwd(), 'public', 'assets', 'products', fileName);
        try {
          const buffer = await fs.readFile(localPath);
          return new NextResponse(toBinaryBody(buffer), {
            headers: {
              'Content-Type': 'image/png',
              'Cache-Control': 'public, max-age=86400',
              'X-Cache': 'MISS-FALLBACK',
            },
          });
        } catch (fallbackError) {
          console.warn(`[ProductImageProxy] Local fallback missing for ${templateId}:`, fallbackError);
        }
      }

      return await readPlaceholderResponse('MISS-PLACEHOLDER');
    }

    const buffer = Buffer.from(base64Image, 'base64');

    try {
      if (!existsSync(CACHE_DIR)) {
        await fs.mkdir(CACHE_DIR, { recursive: true });
      }
      await fs.writeFile(cachePath, buffer);
    } catch (cacheError) {
      console.error('[ProductImageProxy] Failed to write to cache:', cacheError);
    }

    return new NextResponse(toBinaryBody(buffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=43200',
        'X-Cache': 'MISS',
      },
    });
  } catch (error) {
    console.error('[ProductImageProxy] Error fetching image:', error);
    return await readPlaceholderResponse('ERROR-PLACEHOLDER');
  }
}
