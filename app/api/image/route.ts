import { existsSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { NextResponse } from 'next/server';
import { loadImageFromOdoo } from '@/lib/odoo-image-store';
import { ensureStorageDirectory, inferContentTypeFromStorageId, resolveManagedImageFile } from '@/lib/storage';

function toBinaryBody(buffer: Buffer) {
  return new Uint8Array(buffer);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response('Imagen ID no proporcionado', { status: 400 });
  }

  try {
    const { filePath, storageId } = resolveManagedImageFile(id);
    const defaultContentType = inferContentTypeFromStorageId(storageId);

    if (existsSync(filePath)) {
      const fileBuffer = await readFile(filePath);

      return new NextResponse(toBinaryBody(fileBuffer), {
        headers: {
          'Content-Type': defaultContentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    const odooImage = await loadImageFromOdoo(storageId);
    if (odooImage) {
      try {
        await ensureStorageDirectory();
        await writeFile(filePath, odooImage.data);
      } catch (cacheError) {
        console.warn('[ImageBridge] Failed to restore image cache from Odoo:', storageId, cacheError);
      }

      return new NextResponse(toBinaryBody(odooImage.data), {
        headers: {
          'Content-Type': odooImage.contentType || defaultContentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    console.error(`[ImageBridge] 404 Not Found in disk or Odoo: ${filePath}`);
    return new Response('Imagen no encontrada en el servidor de datos ni en Odoo', { status: 404 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid storage id') {
      return new Response('Imagen ID invalido', { status: 400 });
    }

    console.error('[ImageBridge] Error serving image:', error);
    return new Response('Error al leer la imagen del disco u Odoo', { status: 500 });
  }
}
