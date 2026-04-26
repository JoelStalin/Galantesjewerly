import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { OdooService } from '@/lib/odoo/services';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response('Product ID required', { status: 400 });
  }

  try {
    const templateId = parseInt(id, 10);
    let base64Image = await OdooService.getProductImage(templateId);

    if (!base64Image) {
      console.warn(`[ProductImageProxy] Image for ID ${id} not found in Odoo, attempting local fallback...`);
      // Map IDs to local assets for functional demo stability
      const localMap: Record<string, string> = {
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

      const fileName = localMap[id] || 'the-islamorada-solitaire.png'; // Default to ID 1 if not found
      
      const localPath = path.join(process.cwd(), 'public', 'assets', 'products', fileName);
      const buffer = await fs.readFile(localPath);
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=86400'
        }
      });
    }

    const buffer = Buffer.from(base64Image, 'base64');

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=43200'
      }
    });
  } catch (error) {
    console.error('[ProductImageProxy] Error fetching image:', error);
    return new Response('Error fetching product image', { status: 500 });
  }
}
