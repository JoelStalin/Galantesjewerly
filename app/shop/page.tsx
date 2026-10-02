/**
 * Shop Page - Premium Jewelry Catalog
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

  const activeFilters: ActiveFilters = [];
  if (params.q)         activeFilters.push({ label: `"${params.q}"`, key: 'q' });
  if (params.category)  activeFilters.push({ label: params.category, key: 'category' });
  if (params.material)  activeFilters.push({ label: params.material, key: 'material' });
  if (params.min_price || params.max_price) {
    const label =
      params.min_price && params.max_price
        ? `$${params.min_price} - $${params.max_price}`
        : params.min_price
          ? `From $${params.min_price}`
          : `Up to $${params.max_price}`;
    activeFilters.push({ label, key: 'price' });
  }

  const totalCount = pagination?.total ?? products.length;
  const startItem  = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endItem    = Math.min(page * PAGE_SIZE, totalCount);

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
      <section className="bg-primary text-white pt-24 pb-8 px-6 md:px-12">
        <div className="max-w-7xl mx-auto text-left">
          <h1 className="text-3xl md:text-4xl font-serif font-bold">
            Shop Fine Jewelry
          </h1>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-8 md:px-12">
        <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
          <aside className="lg:sticky lg:top-24 lg:border-r lg:border-gray-100 lg:pr-6">
            <Suspense fallback={<div className="h-80 bg-gray-100 rounded animate-pulse" />}>
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

          <main className="min-w-0">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {activeFilters.map((filter) => (
                  <span
                    key={filter.key}
                    className="inline-flex items-center rounded-full bg-accent/20 px-3 py-1 text-sm font-medium text-primary-dark"
                  >
                    {filter.label}
                  </span>
                ))}
              </div>
              {totalCount > 0 && (
                <p className="text-sm text-gray-500">
                  Showing {startItem}-{endItem} of {totalCount} piece{totalCount !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            {fetchError ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                <h2 className="text-lg font-semibold text-red-800 mb-2">
                  Unable to Load Products
                </h2>
                <p className="text-red-700">{fetchError}</p>
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-20">
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

            {pagination && pagination.pages > 1 && (
              <div className="mt-10">
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
