'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ShopProduct } from '@/lib/odoo/client';
import { useCart } from '@/context/shop/CartContext';

interface ProductCardProps {
  product: ShopProduct;
}

export function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCart();
  const isOutOfStock = product.availability === 'out_of_stock';
  const isPreorder   = product.availability === 'preorder';

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
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
    <Link href={`/shop/${product.slug}`} aria-label={product.name}>
      <div className="group relative bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 h-full flex flex-col">

        {/* Product image */}
        <div className="relative h-72 bg-gray-100 overflow-hidden flex-shrink-0">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400">
              <span className="text-sm select-none">No image available</span>
            </div>
          )}

          {/* Status badge */}
          <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
            {product.isFeatured && !isOutOfStock && (
              <span className="bg-accent text-primary-dark text-xs font-bold px-2.5 py-1 rounded">
                Featured
              </span>
            )}
            {isOutOfStock && (
              <span className="bg-red-500 text-white text-xs font-semibold px-2.5 py-1 rounded">
                Out of Stock
              </span>
            )}
            {isPreorder && (
              <span className="bg-amber-500 text-white text-xs font-semibold px-2.5 py-1 rounded">
                Pre-order
              </span>
            )}
          </div>
        </div>

        {/* Card body */}
        <div className="p-4 flex flex-col flex-1">
          {product.category && (
            <p className="text-xs uppercase text-gray-500 font-semibold mb-1 tracking-wider">
              {product.category}
            </p>
          )}

          <h3 className="text-base font-serif font-semibold text-gray-900 mb-1 line-clamp-2 leading-snug">
            {product.name}
          </h3>

          {(product.tagline || product.shortDescription) && (
            <p className="text-xs text-gray-500 mb-2 line-clamp-2 leading-relaxed">
              {product.tagline || product.shortDescription}
            </p>
          )}

          <div className="mt-auto">
            <span className="text-lg font-bold text-gray-900 block mb-3">
              {new Intl.NumberFormat('en-US', {
                style:    'currency',
                currency: product.currency || 'USD',
              }).format(product.price)}
            </span>

            <button
              onClick={handleAddToCart}
              disabled={isOutOfStock}
              className={`w-full py-2.5 px-4 text-xs uppercase tracking-widest font-bold rounded transition-all duration-200 ${
                isOutOfStock
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-primary text-white hover:bg-accent hover:text-primary-dark shadow-sm hover:shadow-md'
              }`}
            >
              {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}
