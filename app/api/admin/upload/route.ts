import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import sharp from 'sharp';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const isFavicon = formData.get('isFavicon') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No se subió ningún archivo' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    let buffer = Buffer.from(bytes) as any;

    // Ensure storage directory exists
    const storageDir = join(process.cwd(), 'data', 'blobs');
    if (!existsSync(storageDir)) {
      await mkdir(storageDir, { recursive: true });
    }

    // Processing with Sharp
    let sharpInstance = sharp(buffer);
    
    if (isFavicon) {
      buffer = await sharpInstance
        .resize(32, 32, { fit: 'cover' })
        .png()
        .toBuffer() as any;
    } else {
      buffer = await sharpInstance
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer() as any;
    }

    // Save strictly to DATA folder to avoid static server issues
    const timestamp = Date.now();
    const extension = isFavicon ? 'png' : 'webp';
    const filename = `${timestamp}.${extension}`;
    const path = join(storageDir, filename);

    await writeFile(path, buffer);
    console.log(`Fichero guardado en DATA: ${path}`);

    // Return the new dynamic image bridge URL
    return NextResponse.json({ 
      success: true, 
      url: `/api/image?id=${filename}` 
    });
  } catch (error) {
    console.error('Error en la subida:', error);
    return NextResponse.json({ error: 'Error interno al procesar la imagen' }, { status: 500 });
  }
}
