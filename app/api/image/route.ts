import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) return new Response('Missing id', { status: 400 });

  // Strictly look in data/blobs to bypass public/ folder issues in Android
  const filePath = join(process.cwd(), 'data', 'blobs', id);

  if (!existsSync(filePath)) {
    return new Response('Imagen no encontrada en el servidor de datos', { status: 404 });
  }

  try {
    const fileBuffer = await readFile(filePath);
    const ext = id.split('.').pop();
    
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': ext === 'png' ? 'image/png' : 'image/webp',
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    });
  } catch (error) {
    return new Response('Error al leer la imagen del disco', { status: 500 });
  }
}
