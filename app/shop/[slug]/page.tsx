/**
 * Product Detail Page – Conversion-Focused PDP
 *
 * Sections:
 *   1. Breadcrumb
 *   2. Product hero (gallery + info + CTA + trust)
 *   3. About This Piece
 *   4. Product Details
 *   5. Shipping & Care
 *   6. Need a Custom Version?
 *   7. You May Also Like (related products)
 *   8. Contact a Jewelry Specialist
 */

import { getOdooClient }    from '@/lib/odoo/client';
import { notFound }          from 'next/navigation';
import Link                  from 'next/link';
import { Metadata }          from 'next';
import { ProductCTA }        from '@/components/shop/ProductCTA';
import { ProductGallery }    from '@/components/shop/ProductGallery';
import { ProductGrid }       from '@/components/shop/ProductGrid';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product  = await getOdooClient().getProductBySlug(slug);

  if (!product) return { title: 'Product Not Found' };

  return {
    title:       `${product.name} | Galante's Jewelry`,
    description: product.tagline || product.shortDescription || product.longDescription,
    openGraph: {
      title:       product.name,
      description: product.tagline || product.shortDescription || '',
      images:      product.imageUrl ? [product.imageUrl] : [],
    },
  };
}

const TRUST_ITEMS = [
  { icon: '🎁', text: 'Gift-ready packaging' },
  { icon: '🔒', text: 'Secure checkout' },
  { icon: '✨', text: 'Custom orders available' },
  { icon: '💬', text: 'Jewelry concierge support' },
];

export default async function ProductPage({ params }: Props) {
  const { slug }  = await params;
  const client    = getOdooClient();

  const [product, related] = await Promise.all([
    client.getProductBySlug(slug),
    client.getRelatedProducts(slug, 4),
  ]);

  if (!product) notFound();

  const isOutOfStock = product.availability === 'out_of_stock';
  const isPreorder   = product.availability === 'preorder';

  return (
    <div className="min-h-screen bg-white">

      {/* ── Breadcrumb ────────────────────────────────────────────────────── */}
      <nav className="max-w-6xl mx-auto px-6 py-4 text-sm" aria-label="Breadcrumb">
        <ol className="flex items-center gap-2 text-gray-500 list-none p-0 m-0">
          <li><Link href="/shop" className="hover:text-accent transition-colors">Shop</Link></li>
          {product.category && (
            <>
              <li aria-hidden>/</li>
              <li>
                <Link
                  href={`/shop?category=${encodeURIComponent(product.category)}`}
                  className="hover:text-accent transition-colors"
                >
                  {product.category}
                </Link>
              </li>
            </>
          )}
          <li aria-hidden>/</li>
          <li className="text-gray-900 font-medium truncate max-w-xs">{product.name}</li>
        </ol>
      </nav>

      {/* ── Product Hero ──────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">

          {/* Left: Interactive gallery */}
          <ProductGallery
            mainImage={product.imageUrl}
            gallery={product.gallery}
            productName={product.name}
          />

          {/* Right: Product info */}
          <div className="flex flex-col gap-6">

            {/* Category + material badges */}
            <div className="flex gap-3 flex-wrap">
              {product.category && (
                <span className="text-xs uppercase tracking-widest text-gray-500 font-semibold border border-gray-200 rounded-full px-3 py-1">
                  {product.category}
                </span>
              )}
              {product.material && (
                <span className="text-xs uppercase tracking-widest text-gray-500 font-semibold border border-gray-200 rounded-full px-3 py-1">
                  {product.material}
                </span>
              )}
              {product.isFeatured && (
                <span className="text-xs uppercase tracking-widest text-primary-dark font-bold bg-accent rounded-full px-3 py-1">
                  Featured
                </span>
              )}
            </div>

            {/* Title + tagline */}
            <div>
              <h1 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 leading-tight mb-2">
                {product.name}
              </h1>
              {product.tagline && (
                <p className="text-gray-500 text-base italic">{product.tagline}</p>
              )}
            </div>

            {/* Price + availability */}
            <div className="border-t border-b border-gray-100 py-5">
              <p className="text-3xl font-bold text-gray-900 mb-3">
                {new Intl.NumberFormat('en-US', {
                  style:    'currency',
                  currency: product.currency || 'USD',
                }).format(product.price)}
              </p>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    isOutOfStock ? 'bg-red-500' : isPreorder ? 'bg-amber-500' : 'bg-green-500'
                  }`}
                />
                <span className={`text-sm font-semibold ${
                  isOutOfStock ? 'text-red-600' : isPreorder ? 'text-amber-600' : 'text-green-700'
                }`}>
                  {isOutOfStock ? 'Out of Stock' : isPreorder ? 'Pre-order Available' : 'In Stock – Ready to Ship'}
                </span>
              </div>
              {product.sku && (
                <p className="text-xs text-gray-400 mt-2">SKU: {product.sku}</p>
              )}
            </div>

            {/* About This Piece (inline on hero) */}
            {(product.longDescription || product.shortDescription) && (
              <div>
                <h2 className="text-sm uppercase tracking-widest text-gray-500 font-semibold mb-2">
                  About This Piece
                </h2>
                <p className="text-gray-700 leading-relaxed whitespace-pre-line text-sm">
                  {product.longDescription || product.shortDescription}
                </p>
              </div>
            )}

            {/* CTA (client component – uses local cart) */}
            <ProductCTA product={{
              id:           product.id,
              slug:         product.slug,
              name:         product.name,
              price:        product.price,
              imageUrl:     product.imageUrl,
              availability: product.availability,
            }} />

            {/* Trust badges */}
            <ul className="grid grid-cols-2 gap-2 list-none p-0 m-0">
              {TRUST_ITEMS.map((item) => (
                <li key={item.text} className="flex items-center gap-2 text-xs text-gray-600">
                  <span aria-hidden className="text-base">{item.icon}</span>
                  {item.text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ── Detail sections ───────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-0 divide-y divide-gray-100">

        {/* Product Details */}
        {product.productDetails && (
          <section className="py-8">
            <h2 className="text-xl font-serif font-semibold text-gray-900 mb-4">
              Product Details
            </h2>
            <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">
              {product.productDetails}
            </div>
          </section>
        )}

        {/* Shipping & Care */}
        <section className="py-8">
          <h2 className="text-xl font-serif font-semibold text-gray-900 mb-4">
            Shipping &amp; Care
          </h2>
          {product.careAndShipping ? (
            <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">
              {product.careAndShipping}
            </div>
          ) : (
            <ul className="text-sm text-gray-700 space-y-2 list-none p-0 m-0">
              <li>🎁 Complimentary gift-ready packaging on every order</li>
              <li>📦 Free standard shipping on orders over $200 within the US</li>
              <li>🔒 Insured express shipping available at checkout</li>
              <li>✨ Store in the provided jewelry box away from moisture and sunlight</li>
              <li>💎 Professional cleaning recommended every 6–12 months</li>
            </ul>
          )}
        </section>

        {/* Need a Custom Version? */}
        <section className="py-8">
          <h2 className="text-xl font-serif font-semibold text-gray-900 mb-3">
            Need a Custom Version?
          </h2>
          <p className="text-sm text-gray-700 mb-4 leading-relaxed">
            We specialize in custom and bespoke jewelry. Whether you want a
            different metal, stone, or size, our artisans can bring your vision
            to life. Contact our concierge to get started.
          </p>
          <Link
            href="/contact"
            className="inline-block bg-primary text-white px-5 py-2.5 text-sm font-semibold rounded hover:bg-primary-dark transition-colors"
          >
            Request Custom Order
          </Link>
        </section>
      </div>

      {/* ── You May Also Like ─────────────────────────────────────────────── */}
      {related.length > 0 && (
        <section className="border-t border-gray-100 py-12 px-6 md:px-12 bg-gray-50">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-serif font-bold text-gray-900 mb-8">
              You May Also Like
            </h2>
            <ProductGrid products={related} columns={4} />
          </div>
        </section>
      )}

      {/* ── Contact a Jewelry Specialist ──────────────────────────────────── */}
      <section className="bg-primary text-white py-14 px-6 md:px-12 text-center">
        <h2 className="text-2xl font-serif font-bold mb-3">
          Contact a Jewelry Specialist
        </h2>
        <p className="text-base opacity-85 mb-6 max-w-xl mx-auto">
          Questions about this piece, sizing, customization, or gifting?
          Our concierge team is available to help you find exactly what
          you&apos;re looking for.
        </p>
        <Link
          href="/contact"
          className="inline-block bg-accent text-primary-dark px-8 py-3 font-semibold rounded hover:bg-accent-light transition-colors"
        >
          Get in Touch
        </Link>
      </section>
    </div>
  );
}
