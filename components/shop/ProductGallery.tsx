'use client';

import { type MouseEvent, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

interface ProductGalleryProps {
  mainImage?: string;
  gallery?: string[];
  productName: string;
}

const MAGNIFIER_SIZE = 180;
const MAGNIFIER_ZOOM = 2.6;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function ProductGallery({ mainImage, gallery, productName }: ProductGalleryProps) {
  const allImages = useMemo(
    () => [mainImage, ...(gallery || [])].filter(Boolean) as string[],
    [mainImage, gallery],
  );
  const [activeIdx, setActiveIdx] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [magnifier, setMagnifier] = useState<{
    x: number;
    y: number;
    backgroundX: number;
    backgroundY: number;
  } | null>(null);

  const activeImage = allImages[activeIdx] ?? null;
  const totalImages = allImages.length;

  const goToPrevious = () => {
    setActiveIdx((current) => {
      if (totalImages <= 1) return current;
      return current === 0 ? totalImages - 1 : current - 1;
    });
  };

  const goToNext = () => {
    setActiveIdx((current) => {
      if (totalImages <= 1) return current;
      return current === totalImages - 1 ? 0 : current + 1;
    });
  };

  const handleMagnifierMove = (event: MouseEvent<HTMLDivElement>) => {
    if (!activeImage) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const rawX = event.clientX - rect.left;
    const rawY = event.clientY - rect.top;
    const lensHalf = MAGNIFIER_SIZE / 2;

    setMagnifier({
      x: clamp(rawX, lensHalf, rect.width - lensHalf),
      y: clamp(rawY, lensHalf, rect.height - lensHalf),
      backgroundX: (rawX / rect.width) * 100,
      backgroundY: (rawY / rect.height) * 100,
    });
  };

  useEffect(() => {
    if (!zoomOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setZoomOpen(false);
      } else if (event.key === 'ArrowLeft') {
        goToPrevious();
      } else if (event.key === 'ArrowRight') {
        goToNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomOpen, totalImages]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        goToPrevious();
      } else if (event.key === 'ArrowRight') {
        goToNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalImages]);

  return (
    <div data-testid="product-gallery">
      <div
        data-testid="product-gallery-main-image"
        className="mb-4 bg-gray-100 rounded-[1.75rem] overflow-hidden aspect-square relative group"
        onMouseEnter={() => {
          if (activeImage) {
            setMagnifier((current) => current ?? {
              x: MAGNIFIER_SIZE / 2,
              y: MAGNIFIER_SIZE / 2,
              backgroundX: 50,
              backgroundY: 50,
            });
          }
        }}
        onMouseMove={handleMagnifierMove}
        onMouseLeave={() => setMagnifier(null)}
      >
        {activeImage ? (
          <>
            <Image
              src={activeImage}
              alt={productName}
              fill
              className="cursor-zoom-in object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              priority
              sizes="(max-width: 768px) 100vw, 50vw"
            />

            {magnifier && (
              <div
                data-testid="product-image-magnifier"
                aria-hidden="true"
                className="pointer-events-none absolute z-20 rounded-full border border-white/75 shadow-[0_18px_40px_rgba(0,0,0,0.28)] ring-1 ring-black/10"
                style={{
                  width: `${MAGNIFIER_SIZE}px`,
                  height: `${MAGNIFIER_SIZE}px`,
                  left: `${magnifier.x - MAGNIFIER_SIZE / 2}px`,
                  top: `${magnifier.y - MAGNIFIER_SIZE / 2}px`,
                  backgroundImage: `url(${activeImage})`,
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: `${MAGNIFIER_ZOOM * 100}%`,
                  backgroundPosition: `${magnifier.backgroundX}% ${magnifier.backgroundY}%`,
                }}
              />
            )}

            {totalImages > 1 && (
              <>
                <button
                  type="button"
                  onClick={goToPrevious}
                  className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-primary shadow-lg transition hover:bg-white"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={goToNext}
                  className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-primary shadow-lg transition hover:bg-white"
                  aria-label="Next image"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}

            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/60 via-black/20 to-transparent px-4 pb-4 pt-10 text-white">
              <span className="text-[11px] font-bold uppercase tracking-[0.24em]">
                Image {activeIdx + 1} of {totalImages}
              </span>
              <button
                type="button"
                onClick={() => setZoomOpen(true)}
                className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-2 text-xs font-semibold backdrop-blur-sm transition hover:bg-white/25"
                aria-label="Zoom image"
              >
                <Search className="h-4 w-4" />
                Zoom
              </button>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm select-none">
            No image available
          </div>
        )}
      </div>

      {allImages.length > 1 && (
        <div className="grid grid-cols-4 gap-3">
          {allImages.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIdx(idx)}
              className={`aspect-square rounded-lg overflow-hidden border-2 transition-colors ${
                idx === activeIdx
                  ? 'border-accent ring-2 ring-accent/20'
                  : 'border-transparent hover:border-gray-300'
              }`}
              aria-label={`View image ${idx + 1}`}
              aria-pressed={idx === activeIdx}
            >
              <Image
                src={img}
                alt={`${productName} – view ${idx + 1}`}
                width={150}
                height={150}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {zoomOpen && activeImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-label="Product image zoom"
          onClick={() => setZoomOpen(false)}
        >
          <div
            className="relative w-full max-w-6xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setZoomOpen(false)}
              className="absolute right-0 top-0 z-20 rounded-full bg-white/90 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-primary shadow-lg transition hover:bg-white"
              aria-label="Close zoom"
            >
              Close
            </button>

            {totalImages > 1 && (
              <>
                <button
                  type="button"
                  onClick={goToPrevious}
                  className="absolute left-2 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-primary shadow-xl transition hover:bg-white"
                  aria-label="Previous image in zoom"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={goToNext}
                  className="absolute right-2 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-primary shadow-xl transition hover:bg-white"
                  aria-label="Next image in zoom"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}

            <div className="relative mx-auto aspect-[4/3] max-h-[85vh] overflow-hidden rounded-[2rem] border border-white/10 bg-stone-950 shadow-2xl">
              <Image
                src={activeImage}
                alt={productName}
                fill
                className="object-contain"
                sizes="100vw"
              />
            </div>

            <div className="mt-4 flex items-center justify-between text-white">
              <p className="text-sm font-medium">{productName}</p>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/75">
                Image {activeIdx + 1} of {totalImages}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
