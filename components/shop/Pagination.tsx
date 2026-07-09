'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useCallback } from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  /** Current URL query params (excluding page) */
  currentParams: Record<string, string | undefined>;
}

export function Pagination({
  currentPage,
  totalPages,
  hasNext,
  hasPrev,
  currentParams,
}: PaginationProps) {
  const router   = useRouter();
  const pathname = usePathname();

  const goToPage = useCallback(
    (page: number) => {
      const params = new URLSearchParams();
      Object.entries(currentParams).forEach(([k, v]) => {
        if (v) params.set(k, v);
      });
      params.set('page', String(page));
      router.push(`${pathname}?${params.toString()}`);
    },
    [currentParams, pathname, router],
  );

  /** Produce the list of page numbers / ellipsis markers to render. */
  const getPages = (): (number | '...')[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | '...')[] = [1];
    if (currentPage > 3) pages.push('...');
    for (
      let i = Math.max(2, currentPage - 1);
      i <= Math.min(totalPages - 1, currentPage + 1);
      i++
    ) {
      pages.push(i);
    }
    if (currentPage < totalPages - 2) pages.push('...');
    pages.push(totalPages);
    return pages;
  };

  return (
    <nav
      className="flex justify-center items-center gap-1.5 mt-12"
      aria-label="Pagination navigation"
    >
      <button
        onClick={() => goToPage(currentPage - 1)}
        disabled={!hasPrev}
        className="px-3 py-2 rounded border border-gray-300 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
        aria-label="Go to previous page"
      >
        ← Prev
      </button>

      {getPages().map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} className="px-2 text-gray-400 select-none">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => goToPage(p as number)}
            className={`w-9 h-9 rounded border text-sm font-medium transition-colors ${
              p === currentPage
                ? 'bg-primary text-white border-primary'
                : 'border-gray-300 hover:bg-gray-50'
            }`}
            aria-current={p === currentPage ? 'page' : undefined}
            aria-label={`Page ${p}`}
          >
            {p}
          </button>
        ),
      )}

      <button
        onClick={() => goToPage(currentPage + 1)}
        disabled={!hasNext}
        className="px-3 py-2 rounded border border-gray-300 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
        aria-label="Go to next page"
      >
        Next →
      </button>
    </nav>
  );
}
