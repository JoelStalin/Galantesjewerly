import { existsSync } from 'fs';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { getDataRoot } from '@/lib/runtime-paths';

export const MAX_FILE_SIZE = 5 * 1024 * 1024;
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
export const ALLOWED_FILE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
export const STORAGE_BASE = resolve(getDataRoot(), 'blobs');
const INTERNAL_IMAGE_PATH = '/api/image';
type SupportedImageFormat = {
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  extension: 'jpg' | 'png' | 'webp';
};

type SharpProcessor = typeof import('sharp');

let sharpProcessorPromise: Promise<SharpProcessor | null> | null = null;
let hasLoggedSharpFallback = false;

function sanitizeStorageId(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '');
}

function normalizeBaseName(fileName: string) {
  const withoutExtension = fileName.replace(/\.[^/.]+$/, '');
  const normalized = withoutExtension
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  return normalized || 'image';
}

function getFileExtension(fileName: string) {
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex < 0) {
    return '';
  }

  return fileName.slice(lastDotIndex).toLowerCase();
}

function getStorageFilePath(storageId: string) {
  return join(STORAGE_BASE, sanitizeStorageId(storageId));
}

async function getSharpProcessor() {
  if (!sharpProcessorPromise) {
    sharpProcessorPromise = (async () => {
      try {
        const sharpNamespace = await import('sharp');
        return ('default' in sharpNamespace ? sharpNamespace.default : sharpNamespace) as SharpProcessor;
      } catch (error) {
        if (!hasLoggedSharpFallback) {
          console.warn('[Storage] sharp unavailable, using passthrough image storage:', error);
          hasLoggedSharpFallback = true;
        }

        return null;
      }
    })();
  }

  return sharpProcessorPromise;
}

function detectImageFormat(buffer: Buffer): SupportedImageFormat | null {
  if (buffer.length >= 8
    && buffer[0] === 0x89
    && buffer[1] === 0x50
    && buffer[2] === 0x4e
    && buffer[3] === 0x47
    && buffer[4] === 0x0d
    && buffer[5] === 0x0a
    && buffer[6] === 0x1a
    && buffer[7] === 0x0a) {
    return { contentType: 'image/png', extension: 'png' };
  }

  if (buffer.length >= 3
    && buffer[0] === 0xff
    && buffer[1] === 0xd8
    && buffer[2] === 0xff) {
    return { contentType: 'image/jpeg', extension: 'jpg' };
  }

  if (buffer.length >= 12
    && buffer.toString('ascii', 0, 4) === 'RIFF'
    && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return { contentType: 'image/webp', extension: 'webp' };
  }

  return null;
}

export async function getImageProcessingMode() {
  const sharpProcessor = await getSharpProcessor();
  return sharpProcessor ? 'sharp' : 'passthrough';
}

export function buildImageUrl(storageId: string) {
  return `${INTERNAL_IMAGE_PATH}?id=${encodeURIComponent(storageId)}`;
}

export function getStorageIdFromUrl(url?: string | null) {
  if (!url) {
    return null;
  }

  if (!url.startsWith(INTERNAL_IMAGE_PATH)) {
    return null;
  }

  const searchIndex = url.indexOf('?');
  const search = searchIndex >= 0 ? url.slice(searchIndex + 1) : '';
  const params = new URLSearchParams(search);
  const storageId = params.get('id');

  if (!storageId) {
    return null;
  }

  const safeStorageId = sanitizeStorageId(storageId);
  return safeStorageId || null;
}

export function isManagedImageUrl(url?: string | null) {
  return Boolean(getStorageIdFromUrl(url));
}

export async function ensureStorageDirectory() {
  if (!existsSync(STORAGE_BASE)) {
    await mkdir(STORAGE_BASE, { recursive: true });
  }
}

export async function saveProcessedImage(file: File, options?: { isFavicon?: boolean }) {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('El archivo es demasiado grande (maximo 5MB)');
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error('Formato de archivo no permitido. Use JPG, PNG o WEBP.');
  }

  if (!ALLOWED_FILE_EXTENSIONS.includes(getFileExtension(file.name))) {
    throw new Error('Formato de archivo no permitido. Use JPG, PNG o WEBP.');
  }

  await ensureStorageDirectory();

  const isFavicon = Boolean(options?.isFavicon);
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const sharpProcessor = await getSharpProcessor();

  let processedBuffer: Buffer;
  let contentType: SupportedImageFormat['contentType'];
  let extension: SupportedImageFormat['extension'];

  if (sharpProcessor) {
    try {
      processedBuffer = isFavicon
        ? await sharpProcessor(buffer).resize(32, 32, { fit: 'cover' }).png().toBuffer()
        : await sharpProcessor(buffer)
            .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 85 })
            .toBuffer();
      contentType = isFavicon ? 'image/png' : 'image/webp';
      extension = isFavicon ? 'png' : 'webp';
    } catch (error) {
      console.error('[Storage] Invalid image payload:', error);
      throw new Error('El archivo no contiene una imagen valida.');
    }
  } else {
    const detectedFormat = detectImageFormat(buffer);

    if (!detectedFormat) {
      throw new Error('El archivo no contiene una imagen valida.');
    }

    if (isFavicon && detectedFormat.contentType !== 'image/png') {
      throw new Error('En este host el favicon debe subirse en PNG.');
    }

    processedBuffer = buffer;
    contentType = isFavicon ? 'image/png' : detectedFormat.contentType;
    extension = isFavicon ? 'png' : detectedFormat.extension;
  }

  const prefix = isFavicon ? 'favicon' : 'image';
  const storageId = `${prefix}-${Date.now()}-${normalizeBaseName(file.name)}.${extension}`;
  const filePath = getStorageFilePath(storageId);

  await writeFile(filePath, processedBuffer);

  return {
    contentType,
    size: processedBuffer.length,
    storageId,
    url: buildImageUrl(storageId),
  };
}

export async function deleteManagedImage(url?: string | null) {
  const storageId = getStorageIdFromUrl(url);

  if (!storageId) {
    return false;
  }

  try {
    await unlink(getStorageFilePath(storageId));
    return true;
  } catch (error) {
    const fileError = error as NodeJS.ErrnoException;

    if (fileError.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}

export function resolveManagedImageFile(urlOrId: string) {
  const storageId = getStorageIdFromUrl(urlOrId) || sanitizeStorageId(urlOrId);

  if (!storageId) {
    throw new Error('Invalid storage id');
  }

  return {
    filePath: getStorageFilePath(storageId),
    storageId,
  };
}
