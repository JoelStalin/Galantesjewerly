'use client';

import { useState } from 'react';
import Image from 'next/image';

interface ProductGalleryProps {
  mainImage?: string;
  gallery?: string[];
  productName: string;
}

/**
 * Interactive product image gallery with thumbnail switching.
 * Used on the Product Detail Page.
 */
export function ProductGallery({ mainImage, gallery, productName }: ProductGalleryProps) {
  const allImages = [mainImage, ...(gallery || [])].filter(Boolean) as string[];
  const [activeIdx, setActiveIdx] = useState(0);

  const activeImage = allImages[activeIdx] ?? null;

  return (
    <div>
      {/* Main image */}
      <div className="mb-4 bg-gray-100 rounded-lg overflow-hidden aspect-square relative">
        {activeImage ? (
          <Image
            src={activeImage}
            alt={productName}
            fill
            className="object-cover"
            priority
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm select-none">
            No image available
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {allImages.length > 1 && (
        <div className="grid grid-cols-4 gap-3">
          {allImages.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIdx(idx)}
              className={`aspect-square rounded-lg overflow-hidden border-2 transition-colors ${
                idx === activeIdx
                  ? 'border-accent'
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
    </div>
  );
}
