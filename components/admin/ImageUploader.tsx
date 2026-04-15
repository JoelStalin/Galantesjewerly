"use client";

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

interface ImageUploaderProps {
  label: string;
  currentUrl: string;
  onUploadSuccess: (url: string) => void;
  onUploadStateChange?: (isUploading: boolean) => void;
  isFavicon?: boolean;
  onRemove?: () => void;
  inputTestId?: string;
  previewTestId?: string;
  removeButtonTestId?: string;
}

export default function ImageUploader({ label, currentUrl, onUploadSuccess, onUploadStateChange, isFavicon, onRemove, inputTestId, previewTestId, removeButtonTestId }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');

    // Client-side validation
    if (file.size > 5 * 1024 * 1024) {
      setError('El archivo es demasiado grande (máximo 5MB).');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('Solo se permiten archivos de imagen.');
      return;
    }

    // Show immediate preview
    if (preview) {
      URL.revokeObjectURL(preview);
    }

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    uploadFile(file);
  };

  const handleRemove = () => {
    if (preview) {
      URL.revokeObjectURL(preview);
    }

    setError('');
    setPreview(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    onRemove?.();
  };

  const uploadFile = async (file: File | Blob, fileName?: string) => {
    setUploading(true);
    onUploadStateChange?.(true);

    try {
      const formData = new FormData();
      formData.append('file', file, fileName || (file as File).name);
      if (isFavicon) {
        formData.append('isFavicon', 'true');
      }

      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.status === 401) {
        window.location.replace('/admin/login');
        return;
      }

      const data = await res.json();

      if (data.success) {
        onUploadSuccess(data.url);
        setError('');
        setPreview(null);
      } else {
        const errorMsg = data.error || 'Error desconocido';
        console.error('[Uploader] Server Error:', errorMsg);
        setError(errorMsg);
      }
    } catch (err) {
      console.error('[Uploader] Connection Error:', err);
      setError('Error de conexión con el servidor. Verifique que la aplicación esté corriendo.');
    } finally {
      setUploading(false);
      onUploadStateChange?.(false);
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">{label}</label>

      <div className="flex items-start gap-4">
        {/* Preview Area */}
        <div className="relative w-20 h-20 rounded-lg border-2 border-dashed border-zinc-200 bg-zinc-50 flex items-center justify-center overflow-hidden flex-shrink-0 group">
          {(preview || currentUrl) ? (
            <Image
              src={preview || currentUrl}
              alt="Preview"
              data-testid={previewTestId}
              className="object-contain"
              fill
              unoptimized
            />
          ) : (
            <div className="text-zinc-300">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            </div>
          )}
        </div>

        {/* Info & Action Area */}
        <div className="flex-grow space-y-2">
          <div className="text-[10px] text-zinc-400 max-w-[200px] leading-relaxed">
            {isFavicon ? 'Se convertirá automáticamente a 32x32px (Cuadrado)' : 'Formatos recomendados: JPG, PNG, WEBP.'}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-[11px] font-bold uppercase tracking-widest text-amber-600 hover:text-amber-700 hover:bg-amber-50 px-3 py-1.5 rounded border border-amber-200 transition-all"
              disabled={uploading}
            >
              {uploading ? 'Subiendo...' : 'Seleccionar Archivo'}
            </button>
            {(preview || currentUrl) && (
              <button
                type="button"
                onClick={handleRemove}
                data-testid={removeButtonTestId}
                className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50 px-3 py-1.5 rounded border border-zinc-200 transition-all"
                disabled={uploading}
              >
                Quitar Imagen
              </button>
            )}
          </div>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] leading-relaxed text-red-700">
              {error}
            </div>
          )}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            data-testid={inputTestId}
            className="hidden"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          />
        </div>
      </div>

      {/* Hidden canvas for processing */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
