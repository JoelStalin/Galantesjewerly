"use client";

import { useState, useEffect } from 'react';
import type { FeaturedItem } from '@/lib/db';

export function FeaturedCarousel({ items }: { items: FeaturedItem[] }) {
  const [startIndex, setStartIndex] = useState(0);
  const [fade, setFade] = useState(true);

  // Auto-rotate every 5 seconds if there are more than 3 items
  useEffect(() => {
    if (items.length <= 3) return;
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setStartIndex((prev) => (prev + 1) % items.length);
        setFade(true);
      }, 300); // 300ms fade out
    }, 5000);
    return () => clearInterval(interval);
  }, [items.length]);

  if (!items || items.length === 0) return null;

  // Render a slice of up to 3 items circularly
  const visibleItems = [];
  for (let i = 0; i < Math.min(3, items.length); i++) {
    visibleItems.push(items[(startIndex + i) % items.length]);
  }

  return (
    <div className="max-w-7xl mx-auto w-full">
       <div className={`grid grid-cols-1 md:grid-cols-3 gap-12 transition-opacity duration-300 ${fade ? 'opacity-100' : 'opacity-0'}`}>
          {visibleItems.map((feat, i) => (
             <div key={`${feat.id}-${startIndex}-${i}`} data-testid={`featured-public-card-${feat.id}`} data-title={feat.title} className="flex flex-col items-center text-center">
                <div className="w-full h-80 bg-stone-100 mb-6 relative overflow-hidden group">
                   <div
                     data-testid={`featured-public-image-${feat.id}`}
                     data-image-url={feat.image_url}
                     className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                     style={{ backgroundImage: `url('${feat.image_url}')` }}
                   ></div>
                </div>
                <h3 className="text-2xl mb-3">{feat.title}</h3>
                <p className="opacity-70 text-sm mb-4">{feat.content_text}</p>
                {feat.action_text && (
                   <a href={feat.action_link || "#"} className="text-primary font-semibold uppercase tracking-wider text-xs border-b border-primary pb-1">
                     {feat.action_text}
                   </a>
                )}
             </div>
          ))}
       </div>

       {items.length > 3 && (
         <div className="flex justify-center gap-3 mt-12">
            {items.map((_, idx) => (
              <button
                key={idx}
                data-testid={`featured-dot-${idx}`}
                onClick={() => {
                  setFade(false);
                  setTimeout(() => { setStartIndex(idx); setFade(true); }, 300);
                }}
                className={`h-2 rounded-full transition-all duration-300 ${idx === startIndex ? 'bg-primary w-8' : 'bg-primary/20 w-2 hover:bg-primary/50'}`}
                aria-label={`Ver colección ${idx + 1}`}
              />
            ))}
         </div>
       )}
    </div>
  );
}
