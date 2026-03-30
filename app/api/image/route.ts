import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolveManagedImageFile } from '@/lib/storage';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response('Imagen ID no proporcionado', { status: 400 });
  }

  try {
    const { filePath, storageId } = resolveManagedImageFile(id);

    if (!existsSync(filePath)) {
      console.error(`[ImageBridge] 404 Not Found: ${filePath}`);
      return new Response('Imagen no encontrada en el servidor de datos', { status: 404 });
    }

    const fileBuffer = await readFile(filePath);
    const ext = storageId.split('.').pop();
    
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': ext === 'png' ? 'image/png' : 'image/webp',
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid storage id') {
      return new Response('Imagen ID inválido', { status: 400 });
    }

    console.error('[ImageBridge] Error serving image:', error);
    return new Response('Error al leer la imagen del disco', { status: 500 });
  }
}
