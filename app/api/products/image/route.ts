import { NextResponse } from 'next/server';
import { OdooService } from '@/lib/odoo/services';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response('Product ID required', { status: 400 });
  }

  try {
    const templateId = parseInt(id, 10);
    const base64Image = await OdooService.getProductImage(templateId);

    if (!base64Image) {
      return new Response('Image not found', { status: 404 });
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
