'use client';

import Link from 'next/link';
import { useCart } from '@/context/shop/CartContext';
import type { ShopProduct } from '@/lib/odoo/client';

interface ProductCTAProps {
  product: Pick<ShopProduct, 'id' | 'slug' | 'name' | 'price' | 'imageUrl' | 'availability'>;
}

/**
 * Client-side CTA block for the Product Detail Page.
 * Adds the product to the local cart (consistent with the ProductCard behaviour).
 */
export function ProductCTA({ product }: ProductCTAProps) {
  const { addItem } = useCart();

  const isOutOfStock = product.availability === 'out_of_stock';
  const isPreorder   = product.availability === 'preorder';

  const handleAddToCart = () => {
    addItem({
      id:        product.id,
      slug:      product.slug,
      name:      product.name,
      price:     product.price,
      quantity:  1,
      image_url: product.imageUrl,
    });
  };

  return (
    <div className="space-y-3">
      {/* Primary: Add to Cart / Pre-order / Out of Stock */}
      <button
        onClick={handleAddToCart}
        disabled={isOutOfStock}
        className={`w-full py-4 px-6 rounded font-semibold text-base transition-colors ${
          isOutOfStock
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
            : 'bg-accent text-primary-dark hover:bg-accent-light'
        }`}
        aria-label={
          isOutOfStock ? 'Out of stock' : isPreorder ? 'Pre-order now' : 'Add to cart'
        }
      >
        {isOutOfStock ? 'Out of Stock' : isPreorder ? 'Pre-order Now' : 'Add to Cart'}
      </button>

      {/* Secondary: concierge CTA */}
      <Link
        href="/contact"
        className="block w-full py-3 px-6 border-2 border-primary text-primary text-center font-semibold rounded hover:bg-primary hover:text-white transition-colors"
      >
        Chat with Our Concierge
      </Link>
    </div>
  );
}
