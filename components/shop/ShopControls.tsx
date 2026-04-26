'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState, useCallback, useEffect } from 'react';
import type { CategoryData } from '@/lib/odoo/client';

const SORT_OPTIONS = [
  { value: 'featured',     label: 'Featured' },
  { value: 'newest',       label: 'Newest' },
  { value: 'price_asc',    label: 'Price: Low to High' },
  { value: 'price_desc',   label: 'Price: High to Low' },
  { value: 'alphabetical', label: 'Alphabetical' },
] as const;

const MATERIAL_OPTIONS = [
  { value: '',             label: 'All Materials' },
  { value: 'gold',         label: 'Gold' },
  { value: 'gold_14k',     label: '14K Gold' },
  { value: 'gold_18k',     label: '18K Gold' },
  { value: 'rose_gold',    label: 'Rose Gold' },
  { value: 'white_gold',   label: 'White Gold' },
  { value: 'silver',       label: 'Sterling Silver' },
  { value: 'silver_925',   label: '925 Silver' },
  { value: 'platinum',     label: 'Platinum' },
  { value: 'gemstone',     label: 'Gemstone' },
  { value: 'mixed',        label: 'Mixed Materials' },
] as const;

export type ActiveFilters = { label: string; key: string }[];

interface CurrentFilters {
  q?: string;
  category?: string;
  material?: string;
  sort?: string;
  min_price?: string;
  max_price?: string;
}

interface ShopControlsProps {
  categories: CategoryData[];
  currentFilters: CurrentFilters;
  totalCount: number;
  startItem: number;
  endItem: number;
  activeFilters: ActiveFilters;
  layout?: 'horizontal' | 'sidebar';
}

export function ShopControls({
  categories,
  currentFilters,
  totalCount,
  startItem,
  endItem,
  activeFilters,
  layout = 'horizontal',
}: ShopControlsProps) {
  const router   = useRouter();
  const pathname = usePathname();

  const [searchInput, setSearchInput] = useState(currentFilters.q || '');
  const [showFilters, setShowFilters] = useState(false);

  // Keep local search input in sync when URL changes (e.g. browser back)
  useEffect(() => {
    setSearchInput(currentFilters.q || '');
  }, [currentFilters.q]);

  /** Build a new URL with the provided param updates and navigate. */
  const navigate = useCallback(
    (updates: Record<string, string | undefined>, resetPage = true) => {
      const params = new URLSearchParams();
      const merged: Record<string, string | undefined> = { ...currentFilters, ...updates };
      if (resetPage) delete merged.page;
      Object.entries(merged).forEach(([k, v]) => {
        if (v) params.set(k, v);
      });
      router.push(`${pathname}?${params.toString()}`);
    },
    [currentFilters, pathname, router],
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ q: searchInput.trim() || undefined });
  };

  const clearAll = () => router.push(pathname);

  const inputClass = 'w-full rounded-lg border border-primary/10 bg-white px-4 py-2.5 text-sm text-primary placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors';
  const labelClass = 'mb-3 block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground';

  if (layout === 'sidebar') {
    return (
      <div className="space-y-12">
        {/* Search */}
        <section>
          <label className={labelClass}>Search Collection</label>
          <form onSubmit={handleSearch} className="relative">
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search pieces..."
              className={inputClass}
            />
            <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/40 hover:text-accent">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
               </svg>
            </button>
          </form>
        </section>

        {/* Categories */}
        {categories.length > 0 && (
          <section>
            <label className={labelClass}>Categories</label>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => navigate({ category: undefined })}
                  className={`text-sm transition-colors hover:text-accent ${!currentFilters.category ? 'font-bold text-primary underline underline-offset-8 decoration-accent' : 'text-muted-foreground'}`}
                >
                  All Collections
                </button>
              </li>
              {categories.map((cat) => (
                <li key={cat.id}>
                  <button
                    onClick={() => navigate({ category: cat.name })}
                    className={`text-sm transition-colors text-left hover:text-accent ${currentFilters.category?.toLowerCase() === cat.name.toLowerCase() ? 'font-bold text-primary underline underline-offset-8 decoration-accent' : 'text-muted-foreground'}`}
                  >
                    {cat.name}
                    <span className="ml-2 text-[10px] opacity-40 font-normal">({cat.count})</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Material */}
        <section>
          <label htmlFor="material-sidebar" className={labelClass}>Material</label>
          <select
            id="material-sidebar"
            value={currentFilters.material || ''}
            onChange={(e) => navigate({ material: e.target.value || undefined })}
            className={inputClass}
          >
            {MATERIAL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </section>

        {/* Price Range */}
        <section>
          <label className={labelClass}>Price Range</label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              placeholder="Min"
              value={currentFilters.min_price || ''}
              onChange={(e) => navigate({ min_price: e.target.value || undefined })}
              className={inputClass}
              min={0}
            />
            <span className="text-primary/20">—</span>
            <input
              type="number"
              placeholder="Max"
              value={currentFilters.max_price || ''}
              onChange={(e) => navigate({ max_price: e.target.value || undefined })}
              className={inputClass}
              min={0}
            />
          </div>
        </section>

        {/* Sort */}
        <section>
          <label htmlFor="sort-sidebar" className={labelClass}>Sort By</label>
          <select
            id="sort-sidebar"
            value={currentFilters.sort || 'featured'}
            onChange={(e) => navigate({ sort: e.target.value })}
            className={inputClass}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </section>

        {/* Mobile Toggle Info */}
        <div className="lg:hidden pt-6 border-t border-primary/5">
           <button onClick={clearAll} className="text-[10px] font-bold uppercase tracking-widest text-accent hover:underline">Reset All Filters</button>
        </div>
      </div>
    );
  }

  // Legacy / Horizontal layout (if needed)
  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by name, style, material, or SKU"
          className="flex-1 border border-gray-300 rounded px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
          aria-label="Search products"
        />
        <button
          type="submit"
          className="bg-primary text-white px-5 py-2.5 rounded text-sm font-semibold hover:bg-primary-dark transition-colors whitespace-nowrap"
        >
          Search
        </button>
      </form>

      {/* Category Pills */}
      {categories.length > 0 && (
        <nav aria-label="Product categories">
          <ul className="flex gap-2 flex-wrap list-none p-0 m-0">
            <li>
              <button
                onClick={() => navigate({ category: undefined })}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  !currentFilters.category
                    ? 'bg-primary text-white'
                    : 'border border-gray-300 text-gray-700 hover:border-primary hover:text-primary'
                }`}
              >
                All
              </button>
            </li>
            {categories.map((cat) => (
              <li key={cat.id}>
                <button
                  onClick={() => navigate({ category: cat.name })}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    currentFilters.category?.toLowerCase() === cat.name.toLowerCase()
                      ? 'bg-primary text-white'
                      : 'border border-gray-300 text-gray-700 hover:border-primary hover:text-primary'
                  }`}
                >
                  {cat.name}
                  {cat.count > 0 && (
                    <span className="ml-1.5 text-xs opacity-65">({cat.count})</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* Filter + Sort Bar */}
      <div className="border-t border-gray-100 pt-4">
        {/* Mobile: toggle filters */}
        <div className="flex items-center justify-between mb-3 md:hidden">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="flex items-center gap-2 text-sm font-semibold text-primary border border-primary/30 rounded px-3 py-1.5"
          >
            <span>Filters &amp; Sort</span>
            <span aria-hidden>{showFilters ? '▲' : '▼'}</span>
          </button>
          {totalCount > 0 && (
            <p className="text-xs text-gray-500">
              {totalCount} piece{totalCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Controls row (always visible on desktop, toggleable on mobile) */}
        <div className={`flex flex-wrap items-center gap-3 ${showFilters ? 'flex' : 'hidden md:flex'}`}>
          {/* Material */}
          <div className="flex items-center gap-2">
            <label htmlFor="material-select" className="text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap">
              Material
            </label>
            <select
              id="material-select"
              value={currentFilters.material || ''}
              onChange={(e) => navigate({ material: e.target.value || undefined })}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {MATERIAL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Price range */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap">
              Price
            </label>
            <input
              type="number"
              placeholder="Min $"
              value={currentFilters.min_price || ''}
              onChange={(e) => navigate({ min_price: e.target.value || undefined })}
              className="w-20 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              min={0}
              aria-label="Minimum price"
            />
            <span className="text-gray-400 text-sm">–</span>
            <input
              type="number"
              placeholder="Max $"
              value={currentFilters.max_price || ''}
              onChange={(e) => navigate({ max_price: e.target.value || undefined })}
              className="w-20 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              min={0}
              aria-label="Maximum price"
            />
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2 md:ml-auto">
            <label htmlFor="sort-select" className="text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap">
              Sort by
            </label>
            <select
              id="sort-select"
              value={currentFilters.sort || 'featured'}
              onChange={(e) => navigate({ sort: e.target.value })}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Active filter chips + result count */}
      <div className="flex items-center justify-between gap-3 flex-wrap min-h-[24px]">
        <div className="flex items-center gap-2 flex-wrap">
          {activeFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => removeFilter(f.key)}
              className="inline-flex items-center gap-1.5 bg-accent/20 text-primary-dark px-3 py-1 rounded-full text-sm font-medium hover:bg-accent/30 transition-colors"
              aria-label={`Remove filter: ${f.label}`}
            >
              {f.label}
              <span aria-hidden className="font-bold leading-none">×</span>
            </button>
          ))}
          {activeFilters.length > 0 && (
            <button
              onClick={clearAll}
              className="text-sm text-gray-500 underline hover:text-gray-700 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
        {totalCount > 0 && (
          <p className="text-sm text-gray-500 ml-auto">
            Showing {startItem}–{endItem} of {totalCount} piece{totalCount !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  );
}
