/**
 * Product Detail Page
 *
 * Displays a single product with full information and purchase CTA.
 * Slug matches Odoo product.template.slug field.
 */

import { getOdooClient } from '@/lib/odoo/client';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Metadata } from 'next';

export const revalidate = 3600; // Revalidate every hour

export async function generateMetadata({
  params,
}: PageProps<'/shop/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const client = getOdooClient();
  const product = await client.getProductBySlug(slug);

  if (!product) {
    return { title: 'Product Not Found' };
  }

  return {
    title: `${product.name} | Galante's Jewelry`,
    description: product.shortDescription || product.longDescription,
    openGraph: {
      title: product.name,
      description: product.shortDescription || product.longDescription,
      images: product.imageUrl ? [product.imageUrl] : [],
    },
  };
}

export default async function ProductPage({ params }: PageProps<'/shop/[slug]'>) {
  const { slug } = await params;
  const client = getOdooClient();
  const product = await client.getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const isOutOfStock = product.availability === 'out_of_stock';
  const isPreorder = product.availability === 'preorder';

  return (
    <div className="min-h-screen bg-white">
      {/* Breadcrumb */}
      <nav className="max-w-6xl mx-auto px-6 py-4 text-sm">
        <div className="flex items-center gap-2 text-gray-600">
          <Link href="/shop" className="hover:text-accent">
            Shop
          </Link>
          <span>/</span>
          {product.category && (
            <>
              <a href={`/shop?category=${product.category}`} className="hover:text-accent">
                {product.category}
              </a>
              <span>/</span>
            </>
          )}
          <span className="text-gray-900 font-semibold">{product.name}</span>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Image Section */}
          <div>
            {/* Primary Image */}
            <div className="mb-6 bg-gray-100 rounded-lg overflow-hidden aspect-square relative">
              {product.imageUrl ? (
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  fill
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  No image available
                </div>
              )}
            </div>

            {/* Gallery */}
            {product.gallery && product.gallery.length > 0 && (
              <div className="grid grid-cols-4 gap-4">
                {product.gallery.map((imageUrl, idx) => (
                  <div
                    key={idx}
                    className="aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-75 transition-opacity"
                  >
                    <Image
                      src={imageUrl}
                      alt={`${product.name} - Image ${idx + 2}`}
                      width={150}
                      height={150}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Product Info Section */}
          <div className="flex flex-col">
            {/* Category & Material */}
            <div className="flex gap-4 mb-4">
              {product.category && (
                <span className="text-xs uppercase text-gray-500 font-semibold">
                  {product.category}
                </span>
              )}
              {product.material && (
                <span className="text-xs uppercase text-gray-500 font-semibold">
                  {product.material}
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-gray-900 mb-6">
              {product.name}
            </h1>

            {/* Price & Availability */}
            <div className="mb-8 pb-8 border-b border-gray-200">
              <p className="text-3xl font-bold text-gray-900 mb-4">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: product.currency || 'USD',
                }).format(product.price)}
              </p>

              {/* Availability Status */}
              <div className="flex items-center gap-3 mb-4">
                {isOutOfStock && (
                  <>
                    <span className="inline-block w-3 h-3 bg-red-500 rounded-full"></span>
                    <span className="text-red-600 font-semibold">Out of Stock</span>
                  </>
                )}
                {isPreorder && (
                  <>
                    <span className="inline-block w-3 h-3 bg-amber-500 rounded-full"></span>
                    <span className="text-amber-600 font-semibold">
                      Pre-order Available
                    </span>
                  </>
                )}
                {product.availability === 'in_stock' && (
                  <>
                    <span className="inline-block w-3 h-3 bg-green-500 rounded-full"></span>
                    <span className="text-green-600 font-semibold">In Stock</span>
                  </>
                )}
              </div>

              {product.sku && (
                <p className="text-sm text-gray-600">SKU: {product.sku}</p>
              )}
            </div>

            {/* Description */}
            {product.longDescription && (
              <div className="mb-8 pb-8 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  About This Piece
                </h2>
                <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                  {product.longDescription}
                </p>
              </div>
            )}

            {/* Short Description */}
            {product.shortDescription && (
              <p className="text-gray-600 mb-8 italic">
                {product.shortDescription}
              </p>
            )}

            {/* CTA Button */}
            <a
              href={product.buyUrl}
              className={`w-full py-4 px-6 text-center font-semibold rounded text-lg transition-colors ${
                isOutOfStock
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-accent text-primary-dark hover:bg-accent-light'
              }`}
              {...(isOutOfStock && { 'aria-disabled': 'true' })}
            >
              {isOutOfStock
                ? 'Out of Stock'
                : isPreorder
                  ? 'Pre-order Now'
                  : 'Add to Cart'}
            </a>

            {/* Concierge CTA */}
            <button className="w-full mt-4 py-4 px-6 border-2 border-accent text-accent font-semibold rounded hover:bg-accent hover:text-primary-dark transition-colors">
              <a href="/contact">Chat with Our Concierge</a>
            </button>

            {/* Additional Info */}
            <div className="mt-12 p-6 bg-gray-50 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-4">About Galante&apos;s</h3>
              <p className="text-sm text-gray-600">
                Every piece is selected or created with care. Need a custom
                design or have questions? Our concierge team is here to help you
                find the perfect piece.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Related Products Section (Future Enhancement) */}
      <section className="border-t border-gray-200 mt-16 py-12 px-6 md:px-12">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-serif font-bold text-gray-900 mb-8">
            You Might Also Like
          </h2>
          {/* TODO: Load related products from Odoo */}
          <p className="text-gray-600">Browse our other jewelry pieces...</p>
        </div>
      </section>
    </div>
  );
}
