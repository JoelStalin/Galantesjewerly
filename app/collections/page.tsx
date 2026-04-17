import { getOdooClient, ShopProduct } from '@/lib/odoo/client';
import { ProductGrid } from '@/components/shop/ProductGrid';

export const metadata = { title: "Collections | Galante's Jewelry" };
export const revalidate = 3600;
export const dynamic = 'force-dynamic';

export default async function CollectionsPage() {
  const client = getOdooClient();
  let featuredProducts: ShopProduct[] = [];
  let errorMessage = '';

  try {
    featuredProducts = await client.getFeaturedProducts(8);
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : 'Unable to load featured collections at this time.';
    console.error('Collections page error:', error);
  }

  return (
    <div className="max-w-7xl mx-auto py-24 px-6">
      <div className="text-center mb-16">
        <p className="text-sm uppercase tracking-[0.35em] text-accent mb-4">Collections</p>
        <h1 className="text-5xl font-serif font-bold text-gray-900">Celebrate Timeless Design</h1>
        <p className="mt-4 text-lg text-gray-600 max-w-3xl mx-auto">
          Explore the most sought-after pieces from our Odoo-powered collection, selected for craftsmanship, heritage, and luminous appeal.
        </p>
      </div>

      {errorMessage ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 px-8 py-10 text-center text-red-700">
          <h2 className="text-2xl font-semibold mb-3">Unable to load collections</h2>
          <p>{errorMessage}</p>
        </div>
      ) : featuredProducts.length > 0 ? (
        <ProductGrid products={featuredProducts} columns={3} />
      ) : (
        <div className="rounded-3xl border border-gray-200 bg-gray-50 px-8 py-10 text-center">
          <h2 className="text-2xl font-semibold mb-3">No featured products available yet</h2>
          <p className="text-gray-600">
            Our latest jewelry pieces are being prepared. Please check back soon or contact our concierge for help.
          </p>
        </div>
      )}

      <div className="mt-20 grid gap-16 md:grid-cols-2">
        <div className="rounded-3xl bg-stone-950 p-10 text-white">
          <h2 className="text-3xl font-semibold mb-4">Need help choosing?</h2>
          <p className="text-sm leading-relaxed opacity-90 mb-6">
            Our team can guide you through custom orders, ring sizing, and special requests with a concierge experience aligned to the Galante&apos;s Jewelry aesthetic.
          </p>
          <a
            href="/contact"
            className="inline-flex items-center justify-center rounded-full bg-accent px-8 py-4 text-sm font-semibold uppercase tracking-widest text-primary-dark hover:bg-accent-light transition-colors"
          >
            Contact Concierge
          </a>
        </div>

        <div className="rounded-3xl border border-stone-200 p-10">
          <h2 className="text-3xl font-semibold mb-4">Odoo as source of truth</h2>
          <p className="text-sm leading-relaxed text-gray-600">
            This page is powered by live product data from Odoo 19, including pricing, stock availability, and purchase links. There is no duplicated catalog in the CMS.
          </p>
        </div>
      </div>
    </div>
  );
}
