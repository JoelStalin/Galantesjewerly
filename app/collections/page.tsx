import Image from 'next/image';
import Link from 'next/link';
import { getOdooClient, ShopProduct } from '@/lib/odoo/client';

export const metadata = { title: "Collections | Galante's Jewelry" };
export const revalidate = 3600;
export const dynamic = 'force-dynamic';

const FALLBACK_COLLECTION_ITEMS: ShopProduct[] = [
  {
    id: 'c1',
    slug: 'the-islamorada-solitaire',
    name: 'The Islamorada Solitaire',
    shortDescription: '2ct Diamond on Platinum with Coral Engravings',
    price: 18500,
    currency: 'USD',
    availability: 'in_stock',
    imageUrl: '/assets/products/compass-rose-pendant.png',
    category: 'Bridal',
    buyUrl: '/shop',
  },
  {
    id: 'c2',
    slug: 'mariners-bond-band',
    name: "Mariner's Bond Band",
    shortDescription: '18k Rose Gold Nautical Knot Band',
    price: 2400,
    currency: 'USD',
    availability: 'in_stock',
    imageUrl: '/assets/products/lighthouse-guardian-charm.png',
    category: 'Bridal',
    buyUrl: '/shop',
  },
  {
    id: 'c3',
    slug: 'compass-rose-pendant',
    name: 'The Compass Rose Pendant',
    shortDescription: '18k Gold with Sapphire Center',
    price: 3200,
    currency: 'USD',
    availability: 'in_stock',
    imageUrl: '/assets/products/sirens-pearl-necklace.png',
    category: 'Nautical',
    buyUrl: '/shop',
  },
];

export default async function CollectionsPage() {
  let featuredProducts: ShopProduct[] = [];

  try {
    const client = getOdooClient();
    const result = await client.getCollectionProducts(12);
    if (Array.isArray(result) && result.length > 0) {
      featuredProducts = result;
    } else {
      featuredProducts = FALLBACK_COLLECTION_ITEMS;
    }
  } catch (error) {
    console.error('Collections page error:', error);
    featuredProducts = FALLBACK_COLLECTION_ITEMS;
  }

  return (
    <div className="max-w-7xl mx-auto pt-28 pb-24 px-6">
      <div className="text-center mb-16">
        <p className="text-sm uppercase tracking-[0.35em] text-accent mb-4">Collections</p>
        <h1 className="text-5xl font-serif font-bold text-gray-900">Celebrate Timeless Design</h1>
        <p className="mt-4 text-lg text-gray-600 max-w-3xl mx-auto">
          Explore the most sought-after pieces in our featured collection, selected for craftsmanship, heritage, and luminous appeal.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
        {featuredProducts.map((product) => {
          const description =
            product.shortDescription ||
            product.tagline ||
            product.longDescription ||
            'A featured piece from our signature collection.';

          const itemSlug = product.slug || 'the-islamorada-solitaire';

          return (
            <Link
              key={product.id}
              href={`/shop/${itemSlug}`}
              className="group overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="relative h-80 overflow-hidden bg-stone-100">
                {product.imageUrl ? (
                  <Image
                    src={product.imageUrl}
                    alt={product.name || 'Fine Jewelry Piece'}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    unoptimized={product.imageUrl.startsWith('/api/')}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm uppercase tracking-[0.25em] text-stone-500">
                    Galante&apos;s Fine Jewelry
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

      <div className="mt-20 rounded-3xl bg-stone-950 p-10 text-white">
        <h2 className="text-3xl font-semibold mb-4">Need help choosing?</h2>
        <p className="text-sm leading-relaxed opacity-90 mb-6 max-w-2xl">
          Our team can guide you through custom orders, ring sizing, and special requests with a concierge experience aligned to the Galante&apos;s Jewelry aesthetic.
        </p>
        <Link
          href="/contact"
          className="inline-flex items-center justify-center rounded-full bg-accent px-8 py-4 text-sm font-semibold uppercase tracking-widest text-primary-dark hover:bg-accent-light transition-colors"
        >
          Contact Concierge
        </Link>
      </div>
    </div>
  );
}
