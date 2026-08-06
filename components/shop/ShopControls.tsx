'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState, useCallback } from 'react';
import { Search } from 'lucide-react';
import type { CategoryData } from '@/lib/odoo/client';

const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'alphabetical', label: 'Alphabetical' },
] as const;

const MATERIAL_OPTIONS = [
  { value: '', label: 'All Materials' },
  { value: 'gold', label: 'Gold' },
  { value: 'gold_14k', label: '14K Gold' },
  { value: 'gold_18k', label: '18K Gold' },
  { value: 'rose_gold', label: 'Rose Gold' },
  { value: 'white_gold', label: 'White Gold' },
  { value: 'silver', label: 'Sterling Silver' },
  { value: 'silver_925', label: '925 Silver' },
  { value: 'platinum', label: 'Platinum' },
  { value: 'gemstone', label: 'Gemstone' },
  { value: 'mixed', label: 'Mixed Materials' },
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
  const router = useRouter();
  const pathname = usePathname();

  const [showFilters, setShowFilters] = useState(false);

  const navigate = useCallback(
    (updates: Record<string, string | undefined>, resetPage = true) => {
      const params = new URLSearchParams();
      const merged: Record<string, string | undefined> = { ...currentFilters, ...updates };
      if (resetPage) delete merged.page;
      Object.entries(merged).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [currentFilters, pathname, router],
  );

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const query = String(formData.get('q') || '').trim();
    navigate({ q: query || undefined });
  };

  const removeFilter = (key: string) => {
    if (key === 'price') {
      navigate({ min_price: undefined, max_price: undefined });
    } else {
      navigate({ [key]: undefined });
    }
  };

  const clearAll = () => router.push(pathname);

  const inputClass = 'w-full rounded border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent';
  const sidebarLabelClass = 'mb-3 block text-xs font-semibold uppercase tracking-wider text-gray-500';

  if (layout === 'sidebar') {
    return (
      <div className="space-y-5 text-left">
        {/* Mobile Filter Toggle */}
        <div className="flex items-center justify-between lg:hidden border-b border-gray-100 pb-3">
          <button
            type="button"
            onClick={() => setShowFilters((value) => !value)}
            className="flex items-center gap-2 text-sm font-semibold text-primary bg-gray-50 border border-gray-200 rounded px-4 py-2 hover:bg-gray-100 transition-colors"
          >
            <span>Filters &amp; Refine</span>
            <span aria-hidden>{showFilters ? '▲' : '▼'}</span>
          </button>
          {totalCount > 0 && (
            <p className="text-xs text-gray-500 font-medium">
              {totalCount} piece{totalCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        <div className={`space-y-7 ${showFilters ? 'block' : 'hidden lg:block'}`}>
        <section>
          <label htmlFor="shop-sidebar-search" className={sidebarLabelClass}>
            Search
          </label>
          <form onSubmit={handleSearch} className="relative">
            <input
              id="shop-sidebar-search"
              type="search"
              name="q"
              defaultValue={currentFilters.q || ''}
              placeholder="Search products"
              className={`${inputClass} pr-10`}
              aria-label="Search products"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary"
              aria-label="Search"
            >
              <Search className="h-4 w-4" aria-hidden />
            </button>
          </form>
        </section>

        {categories.length > 0 && (
          <section>
            <h2 className={sidebarLabelClass}>Categories</h2>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => navigate({ category: undefined })}
                  className={`text-left text-sm transition-colors ${!currentFilters.category ? 'font-semibold text-primary' : 'text-gray-600 hover:text-primary'}`}
                >
                  All categories
                </button>
              </li>
              {categories.map((category) => (
                <li key={category.id}>
                  <button
                    onClick={() => navigate({ category: category.name })}
                    className={`flex w-full items-baseline justify-between gap-3 text-left text-sm transition-colors ${currentFilters.category?.toLowerCase() === category.name.toLowerCase() ? 'font-semibold text-primary' : 'text-gray-600 hover:text-primary'}`}
                  >
                    <span>{category.name}</span>
                    {category.count > 0 && <span className="text-xs text-gray-400">({category.count})</span>}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <label htmlFor="material-sidebar" className={sidebarLabelClass}>
            Material
          </label>
          <select
            id="material-sidebar"
            value={currentFilters.material || ''}
            onChange={(event) => navigate({ material: event.target.value || undefined })}
            className={inputClass}
          >
            {MATERIAL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </section>

        <section>
          <h2 className={sidebarLabelClass}>Price</h2>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <input
              type="number"
              placeholder="Min"
              value={currentFilters.min_price || ''}
              onChange={(event) => navigate({ min_price: event.target.value || undefined })}
              className={inputClass}
              min={0}
              aria-label="Minimum price"
            />
            <span className="text-sm text-gray-400">to</span>
            <input
              type="number"
              placeholder="Max"
              value={currentFilters.max_price || ''}
              onChange={(event) => navigate({ max_price: event.target.value || undefined })}
              className={inputClass}
              min={0}
              aria-label="Maximum price"
            />
          </div>
        </section>

        <section>
          <label htmlFor="sort-sidebar" className={sidebarLabelClass}>
            Sort by
          </label>
          <select
            id="sort-sidebar"
            value={currentFilters.sort || 'featured'}
            onChange={(event) => navigate({ sort: event.target.value })}
            className={inputClass}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </section>

        {activeFilters.length > 0 && (
          <section className="border-t border-gray-100 pt-5">
            <button
              onClick={clearAll}
              className="text-sm font-semibold text-primary underline underline-offset-4 transition-colors hover:text-primary-dark"
            >
              Clear all filters
            </button>
          </section>
        )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl mr-auto">
      <form onSubmit={handleSearch} className="flex w-full gap-2">
        <input
          type="search"
          name="q"
          defaultValue={currentFilters.q || ''}
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

      {categories.length > 0 && (
        <nav aria-label="Product categories">
          <ul className="flex gap-2 flex-wrap list-none p-0 m-0">
            <li>
              <button
                onClick={() => navigate({ category: undefined })}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${!currentFilters.category ? 'bg-primary text-white' : 'border border-gray-300 text-gray-700 hover:border-primary hover:text-primary'}`}
              >
                All
              </button>
            </li>
            {categories.map((category) => (
              <li key={category.id}>
                <button
                  onClick={() => navigate({ category: category.name })}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${currentFilters.category?.toLowerCase() === category.name.toLowerCase() ? 'bg-primary text-white' : 'border border-gray-300 text-gray-700 hover:border-primary hover:text-primary'}`}
                >
                  {category.name}
                  {category.count > 0 && <span className="ml-1.5 text-xs opacity-65">({category.count})</span>}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between mb-3 md:hidden">
          <button
            onClick={() => setShowFilters((value) => !value)}
            className="flex items-center gap-2 text-sm font-semibold text-primary border border-primary/30 rounded px-3 py-1.5"
          >
            <span>Filters &amp; Sort</span>
            <span aria-hidden>{showFilters ? '^' : 'v'}</span>
          </button>
          {totalCount > 0 && (
            <p className="text-xs text-gray-500">
              {totalCount} piece{totalCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        <div className={`flex flex-wrap items-center gap-3 ${showFilters ? 'flex' : 'hidden md:flex'}`}>
          <div className="flex items-center gap-2">
            <label htmlFor="material-select" className="text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap">
              Material
            </label>
            <select
              id="material-select"
              value={currentFilters.material || ''}
              onChange={(event) => navigate({ material: event.target.value || undefined })}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {MATERIAL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap">Price</label>
            <input
              type="number"
              placeholder="Min $"
              value={currentFilters.min_price || ''}
              onChange={(event) => navigate({ min_price: event.target.value || undefined })}
              className="w-20 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              min={0}
              aria-label="Minimum price"
            />
            <span className="text-gray-400 text-sm">-</span>
            <input
              type="number"
              placeholder="Max $"
              value={currentFilters.max_price || ''}
              onChange={(event) => navigate({ max_price: event.target.value || undefined })}
              className="w-20 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              min={0}
              aria-label="Maximum price"
            />
          </div>

          <div className="flex items-center gap-2 md:ml-auto">
            <label htmlFor="sort-select" className="text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap">
              Sort by
            </label>
            <select
              id="sort-select"
              value={currentFilters.sort || 'featured'}
              onChange={(event) => navigate({ sort: event.target.value })}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap min-h-[24px]">
        <div className="flex items-center gap-2 flex-wrap">
          {activeFilters.map((filter) => (
            <button
              key={filter.key}
              onClick={() => removeFilter(filter.key)}
              className="inline-flex items-center gap-1.5 bg-accent/20 text-primary-dark px-3 py-1 rounded-full text-sm font-medium hover:bg-accent/30 transition-colors"
              aria-label={`Remove filter: ${filter.label}`}
            >
              {filter.label}
              <span aria-hidden className="font-bold leading-none">x</span>
            </button>
          ))}
          {activeFilters.length > 0 && (
            <button onClick={clearAll} className="text-sm text-gray-500 underline hover:text-gray-700 transition-colors">
              Clear filters
            </button>
          )}
        </div>
        {totalCount > 0 && (
          <p className="text-sm text-gray-500 ml-auto">
            Showing {startItem}-{endItem} of {totalCount} piece{totalCount !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  );
}

