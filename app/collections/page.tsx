import Image from 'next/image';
import Link from 'next/link';
import { getOdooClient, ShopProduct } from '@/lib/odoo/client';

export const metadata = { title: "Collections | Galante's Jewelry" };
export const revalidate = 3600;
export const dynamic = 'force-dynamic';

export default async function CollectionsPage() {
  const client = getOdooClient();
  let featuredProducts: ShopProduct[] = [];
  let errorMessage = '';

  try {
    featuredProducts = await client.getCollectionProducts(12);
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
          Explore the most sought-after pieces in our featured collection, selected for craftsmanship, heritage, and luminous appeal.
        </p>
      </div>

      {errorMessage ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 px-8 py-10 text-center text-red-700">
          <h2 className="text-2xl font-semibold mb-3">Unable to load collections</h2>
          <p>{errorMessage}</p>
        </div>
      ) : featuredProducts.length > 0 ? (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {featuredProducts.map((product) => {
            const description =
              product.shortDescription ||
              product.tagline ||
              product.longDescription ||
              'A featured piece from our signature collection.';

            return (
              <Link
                key={product.id}
                href={`/shop/${product.slug}`}
                className="group overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="relative h-80 overflow-hidden bg-stone-100">
                  {product.imageUrl ? (
                    <Image
                      src={product.imageUrl}
                      alt={product.name}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm uppercase tracking-[0.25em] text-stone-500">
                      No Image
                    </div>
                  )}

                  <div className="absolute left-4 top-4 rounded-full bg-white/90 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-stone-900">
                    Featured
                  </div>
                </div>

                <div className="space-y-4 p-6">
                  {product.category && (
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-700">
                      {product.category}
                    </p>
                  )}

                  <div>
                    <h2 className="text-2xl font-serif text-stone-950">
                      {product.name}
                    </h2>
                    <p className="mt-3 line-clamp-4 text-sm leading-7 text-stone-600">
                      {description}
                    </p>
                  </div>

                  <span className="inline-flex items-center text-xs font-semibold uppercase tracking-[0.28em] text-stone-900 transition-colors group-hover:text-amber-700">
                    View Piece
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-3xl border border-gray-200 bg-gray-50 px-8 py-10 text-center">
          <h2 className="text-2xl font-semibold mb-3">No featured products available yet</h2>
          <p className="text-gray-600">
            Our latest jewelry pieces are being prepared. Please check back soon or contact our concierge for help.
          </p>
        </div>
      )}

      <div className="mt-20 rounded-3xl bg-stone-950 p-10 text-white">
        <h2 className="text-3xl font-semibold mb-4">Need help choosing?</h2>
        <p className="text-sm leading-relaxed opacity-90 mb-6 max-w-2xl">
          Our team can guide you through custom orders, ring sizing, and special requests with a concierge experience aligned to the Galante&apos;s Jewelry aesthetic.
        </p>
        <a
          href="/contact"
          className="inline-flex items-center justify-center rounded-full bg-accent px-8 py-4 text-sm font-semibold uppercase tracking-widest text-primary-dark hover:bg-accent-light transition-colors"
        >
          Contact Concierge
        </a>
      </div>
    </div>
  );
}
