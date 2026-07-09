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

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <section className="bg-primary text-white py-12 px-6 md:px-12">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-serif font-bold mb-3">
            Shop Fine Jewelry
          </h1>
          <p className="text-base md:text-lg opacity-85 max-w-2xl mx-auto">
            Discover bridal pieces, nautical-inspired designs, timeless gifts,
            and custom creations.
          </p>
        </div>
      </section>

      {/* ── Controls + Grid ──────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Search / Category / Filter / Sort controls (interactive client component) */}
        <Suspense fallback={<div className="h-32 bg-gray-100 rounded animate-pulse" />}>
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
          />
        </Suspense>

        {/* Product grid */}
        <div className="mt-8">
          {fetchError ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <h2 className="text-lg font-semibold text-red-800 mb-2">
                Unable to Load Products
              </h2>
              <p className="text-red-700">{fetchError}</p>
            </div>

          ) : products.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-6 select-none" aria-hidden>💎</div>
              <h2 className="text-2xl font-serif font-semibold text-gray-900 mb-3">
                No products matched your search
              </h2>
              <p className="text-gray-600 mb-8">
                Try adjusting your filters or browse another collection.
              </p>
              <Link
                href="/shop"
                className="inline-block bg-accent text-primary-dark px-6 py-3 font-semibold hover:bg-accent-light transition-colors rounded"
              >
                Clear filters
              </Link>
            </div>

          ) : (
            <ProductGrid products={products} columns={3} />
          )}
        </div>

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <Pagination
            currentPage={page}
            totalPages={pagination.pages}
            hasNext={pagination.hasNext}
            hasPrev={pagination.hasPrev}
            currentParams={currentParams}
          />
        )}
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
