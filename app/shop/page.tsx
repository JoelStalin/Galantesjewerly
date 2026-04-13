/**
 * Shop Page - Product Catalog
 *
 * Displays all published products from Odoo catalog.
 * Fetches products via integration-contracts/shop-product.v1.ts schema.
 */

import { getOdooClient } from '@/lib/odoo/client';
import { ProductGrid } from '@/components/shop/ProductGrid';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Shop | Galante's Jewelry",
  description:
    'Explore our collection of fine jewelry including bridal pieces, nautical designs, and custom creations.',
};

export const revalidate = 3600; // Revalidate every hour

export default async function ShopPage() {
  const client = getOdooClient();
  let products = [];
  let error: string | null = null;

  try {
    const response = await client.getProducts(1, 50);
    products = response.data;
  } catch (err) {
    error =
      err instanceof Error
        ? err.message
        : 'Failed to load products. Please try again later.';
    console.error('Shop page error:', err);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-primary text-white py-16 px-6 md:px-12">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-serif font-bold mb-4">
            Our Jewelry Collection
          </h1>
          <p className="text-lg opacity-90">
            Handpicked fine jewelry from Galante's, celebrating the spirit of
            the Florida Keys
          </p>
        </div>
      </section>

      {/* Filter & Sort Section (Optional Enhancement) */}
      <section className="py-8 px-6 md:px-12 border-b border-gray-200">
        <div className="max-w-5xl mx-auto">
          <p className="text-gray-600 text-sm">
            Showing {products.length} products
          </p>
          {/* Future: Add category filters, sort options */}
        </div>
      </section>

      {/* Products Grid */}
      <section className="py-12 px-6 md:px-12">
        <div className="max-w-5xl mx-auto">
          {error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <h2 className="text-lg font-semibold text-red-800 mb-2">
                Unable to Load Products
              </h2>
              <p className="text-red-700">{error}</p>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                No Products Available
              </h2>
              <p className="text-gray-600 mb-8">
                Our shop is being stocked with beautiful pieces. Check back
                soon!
              </p>
            </div>
          ) : (
            <ProductGrid products={products} columns={3} />
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-accent py-16 px-6 md:px-12 text-primary-dark text-center">
        <h2 className="text-3xl font-serif font-bold mb-4">
          Can't Find What You're Looking For?
        </h2>
        <p className="text-lg opacity-90 mb-8">
          Contact our concierge team for custom orders and personalized
          consultations.
        </p>
        <a
          href="/contact"
          className="inline-block bg-primary-dark text-white px-8 py-3 font-semibold hover:bg-gray-800 transition-colors rounded"
        >
          Schedule Consultation
        </a>
      </section>
    </div>
  );
}
