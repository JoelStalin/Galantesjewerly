import { access, mkdir } from 'fs/promises';
import { constants } from 'fs';
import { NextResponse } from 'next/server';
import { getImageProcessingMode, STORAGE_BASE } from '@/lib/storage';

export async function GET() {
  try {
    await mkdir(STORAGE_BASE, { recursive: true });
    await access(STORAGE_BASE, constants.R_OK | constants.W_OK);
    const imageProcessing = await getImageProcessingMode();

    return NextResponse.json({
      imageProcessing,
      status: 'ok',
      storageBase: STORAGE_BASE,
      writable: true,
    });
  } catch {
    const imageProcessing = await getImageProcessingMode().catch(() => 'unknown');
    return NextResponse.json({
      imageProcessing,
      status: 'degraded',
      storageBase: STORAGE_BASE,
      writable: false,
    }, { status: 503 });
  }
}
