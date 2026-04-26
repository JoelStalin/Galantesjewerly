/**
 * Shop Page – Premium Jewelry Catalog
 *
 * Full-featured listing page with search, category navigation,
 * material & price filters, sorting, and real pagination.
 * All search/filter state lives in the URL for shareable links.
 */

import { Suspense }                  from 'react';
import Link                          from 'next/link';
import { getOdooClient }             from '@/lib/odoo/client';
import { ProductGrid }               from '@/components/shop/ProductGrid';
import { ShopControls }              from '@/components/shop/ShopControls';
import { Pagination }                from '@/components/shop/Pagination';
import type { Metadata }             from 'next';
import type { ActiveFilters }        from '@/components/shop/ShopControls';

export const metadata: Metadata = {
  title: "Shop Fine Jewelry | Galante's Jewelry",
  description:
    'Discover bridal pieces, nautical-inspired designs, timeless gifts, and custom creations.',
};

// Every unique filter combination must be rendered fresh from Odoo.
export const dynamic = 'force-dynamic';

type SearchParams = {
  q?:         string;
  category?:  string;
  material?:  string;
  sort?:      string;
  min_price?: string;
  max_price?: string;
  page?:      string;
};

const PAGE_SIZE = 24;

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params  = await searchParams;
  const client  = getOdooClient();
  const page    = Math.max(1, parseInt(params.page || '1', 10));

  // Fetch products and categories in parallel; degrade gracefully on errors.
  const [productsResult, categoriesResult] = await Promise.allSettled([
    client.getProducts({
      q:         params.q,
      category:  params.category,
      material:  params.material,
      sort:      (params.sort as 'featured' | 'newest' | 'price_asc' | 'price_desc' | 'alphabetical') || 'featured',
      min_price: params.min_price ? parseFloat(params.min_price) : undefined,
      max_price: params.max_price ? parseFloat(params.max_price) : undefined,
      page,
      page_size: PAGE_SIZE,
    }),
    client.getCategories(),
  ]);

  const products   = productsResult.status === 'fulfilled' ? productsResult.value.data        : [];
  const pagination = productsResult.status === 'fulfilled' ? productsResult.value.pagination  : null;
  const fetchError = productsResult.status === 'rejected'  ? (productsResult.reason as Error).message : null;
  const categories = categoriesResult.status === 'fulfilled' ? categoriesResult.value         : [];

  // Build active filter chips
  const activeFilters: ActiveFilters = [];
  if (params.q)         activeFilters.push({ label: `"${params.q}"`, key: 'q' });
  if (params.category)  activeFilters.push({ label: params.category, key: 'category' });
  if (params.material)  activeFilters.push({ label: params.material, key: 'material' });
  if (params.min_price || params.max_price) {
    const label =
      params.min_price && params.max_price
        ? `$${params.min_price} – $${params.max_price}`
        : params.min_price
          ? `From $${params.min_price}`
          : `Up to $${params.max_price}`;
    activeFilters.push({ label, key: 'price' });
  }

  const totalCount = pagination?.total ?? products.length;
  const startItem  = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endItem    = Math.min(page * PAGE_SIZE, totalCount);

  // currentParams passed to Pagination so it can preserve existing filters
  const currentParams: Record<string, string | undefined> = {
    q:         params.q,
    category:  params.category,
    material:  params.material,
    sort:      params.sort,
    min_price: params.min_price,
    max_price: params.max_price,
  };

  return (
    <div className="min-h-screen bg-white">
      {/* ── Shop Hero Cover ──────────────────────────────────────────────── */}
      <section className="relative w-full h-[40vh] min-h-[350px] flex items-center justify-center text-white overflow-hidden">
        <div
          className="absolute inset-0 z-0 bg-cover bg-center transition-transform duration-[2000ms] scale-105 hover:scale-100"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?q=80&w=2844&auto=format&fit=crop')" }}
        ></div>
        <div className="absolute inset-0 z-0 bg-black/40 backdrop-blur-[2px]"></div>
        
        <div className="z-10 text-center px-6">
          <h1 className="text-4xl md:text-6xl font-serif font-bold mb-4 drop-shadow-lg tracking-tight">
            Shop Fine Jewelry
          </h1>
          <p className="text-base md:text-xl opacity-90 max-w-2xl mx-auto font-light tracking-wide drop-shadow-md">
            Discover bridal pieces, nautical-inspired designs, and custom creations.
          </p>
        </div>
      </section>

      {/* ── Main Content Area (Sidebar + Grid) ─────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="flex flex-col lg:flex-row gap-12">
          
          {/* Left Sidebar: Filters */}
          <aside className="w-full lg:w-72 shrink-0 space-y-10">
            <Suspense fallback={<div className="h-96 bg-gray-50 rounded-2xl animate-pulse" />}>
              <ShopControls
                categories={categories}
                currentFilters={{
                  q:         params.q,
                  category:  params.category,
                  material:  params.material,
                  sort:      params.sort || 'featured',
                  min_price: params.min_price,
                  max_price: params.max_price,
                }}
                totalCount={totalCount}
                startItem={startItem}
                endItem={endItem}
                activeFilters={activeFilters}
                layout="sidebar"
              />
            </Suspense>
          </aside>

          {/* Right Main: Results */}
          <main className="flex-grow">
            {/* Results Header: Active chips + Sort (Mobile) + Count */}
            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                {activeFilters.map((f) => (
                  <Link
                    key={f.key}
                    href={`/shop?${new URLSearchParams(
                      Object.fromEntries(
                        Object.entries(currentParams).filter(([k]) => 
                          (f.key === 'price' ? (k !== 'min_price' && k !== 'max_price') : k !== f.key) && k !== 'page'
                        ).filter(([_, v]) => v !== undefined) as [string, string][]
                      )
                    ).toString()}`}
                    className="inline-flex items-center gap-1.5 bg-primary/5 text-primary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider hover:bg-accent hover:text-primary-dark transition-all border border-primary/10"
                  >
                    {f.label}
                    <span className="text-base leading-none">&times;</span>
                  </Link>
                ))}
                {activeFilters.length > 0 && (
                  <Link
                    href="/shop"
                    className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-accent transition-colors ml-2"
                  >
                    Clear All
                  </Link>
                )}
              </div>

              {totalCount > 0 && (
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Showing {startItem}–{endItem} of {totalCount} piece{totalCount !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            {/* Product grid */}
            <div className="min-h-[400px]">
              {fetchError ? (
                <div className="bg-red-50 border border-red-100 rounded-2xl p-12 text-center">
                  <h2 className="text-xl font-serif text-red-900 mb-2">
                    Connectivity Interruption
                  </h2>
                  <p className="text-red-700/80 text-sm">{fetchError}</p>
                </div>

              ) : products.length === 0 ? (
                <div className="text-center py-32 bg-stone-50 rounded-3xl border border-dashed border-stone-200">
                  <div className="text-5xl mb-6 opacity-30 select-none">💎</div>
                  <h2 className="text-2xl font-serif text-stone-900 mb-3">
                    No results matched your search
                  </h2>
                  <p className="text-stone-500 mb-8 max-w-md mx-auto">
                    We couldn&apos;t find any pieces with your current filters. Try broadening your criteria or browsing all collections.
                  </p>
                  <Link
                    href="/shop"
                    className="inline-flex bg-primary text-white px-8 py-3 text-xs font-bold uppercase tracking-widest hover:bg-primary-dark transition-all rounded-full shadow-lg"
                  >
                    Reset All Filters
                  </Link>
                </div>

              ) : (
                <ProductGrid products={products} columns={3} />
              )}
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="mt-16 pt-8 border-t border-primary/5">
                <Pagination
                  currentPage={page}
                  totalPages={pagination.pages}
                  hasNext={pagination.hasNext}
                  hasPrev={pagination.hasPrev}
                  currentParams={currentParams}
                />
              </div>
            )}
          </main>

        </div>
      </div>

      {/* ── Bottom CTA ───────────────────────────────────────────────────── */}
      <section className="bg-accent py-14 px-6 md:px-12 text-primary-dark text-center">
        <h2 className="text-3xl font-serif font-bold mb-3">
          Can&apos;t Find What You&apos;re Looking For?
        </h2>
        <p className="text-lg opacity-90 mb-6">
          Contact our concierge team for custom orders and personalized
          consultations.
        </p>
        <Link
          href="/contact"
          className="inline-block bg-primary-dark text-white px-8 py-3 font-semibold hover:bg-gray-800 transition-colors rounded"
        >
          Schedule Consultation
        </Link>
      </section>
    </div>
  );
}
