import { NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth';
import { saveProcessedImage } from '@/lib/storage';

export async function POST(request: Request) {
  const session = await getAdminSessionFromRequest(request);

  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const isFavicon = formData.get('isFavicon') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No se subio ningun archivo' }, { status: 400 });
    }

    try {
      const uploadedImage = await saveProcessedImage(file, { isFavicon });

      return NextResponse.json({
        contentType: uploadedImage.contentType,
        size: uploadedImage.size,
        storageId: uploadedImage.storageId,
        success: true,
        url: uploadedImage.url,
      });
    } catch (storageError) {
      const errorMessage = storageError instanceof Error
        ? storageError.message
        : 'Error interno inesperado en la subida';
      const status = errorMessage.includes('maximo 5MB')
        || errorMessage.includes('Formato de archivo')
        || errorMessage.includes('imagen valida')
        ? 400
        : 500;

      return NextResponse.json({ error: errorMessage }, { status });
    }
  } catch (error) {
    console.error('[Upload] Internal Error:', error);
    return NextResponse.json(
      { error: 'Error interno inesperado en la subida' },
      { status: 500 },
    );
  }
}
