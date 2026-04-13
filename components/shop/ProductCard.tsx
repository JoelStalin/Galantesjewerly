'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ShopProduct } from '@/lib/odoo/client';

interface ProductCardProps {
  product: ShopProduct;
}

export function ProductCard({ product }: ProductCardProps) {
  const isOutOfStock = product.availability === 'out_of_stock';
  const isPreorder = product.availability === 'preorder';

  return (
    <Link href={`/shop/${product.slug}`}>
      <div className="group relative bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
        {/* Image Container */}
        <div className="relative h-80 bg-gray-100 overflow-hidden">
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
              <span className="text-sm">No image available</span>
            </div>
          )}

          {/* Availability Badge */}
          <div className="absolute top-4 right-4">
            {isOutOfStock && (
              <span className="bg-red-500 text-white text-xs font-semibold px-3 py-1 rounded">
                Out of Stock
              </span>
            )}
            {isPreorder && (
              <span className="bg-amber-500 text-white text-xs font-semibold px-3 py-1 rounded">
                Pre-order
              </span>
            )}
            {product.availability === 'in_stock' && (
              <span className="bg-green-500 text-white text-xs font-semibold px-3 py-1 rounded">
                In Stock
              </span>
            )}
          </div>
        </div>

        {/* Product Info */}
        <div className="p-4">
          {/* Category */}
          {product.category && (
            <p className="text-xs uppercase text-gray-500 font-semibold mb-2">
              {product.category}
            </p>
          )}

          {/* Name */}
          <h3 className="text-lg font-serif font-semibold text-gray-900 mb-2 line-clamp-2">
            {product.name}
          </h3>

          {/* Short Description */}
          {product.shortDescription && (
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
              {product.shortDescription}
            </p>
          )}

          {/* Material */}
          {product.material && (
            <p className="text-xs text-gray-500 mb-3">
              <span className="font-semibold">Material:</span> {product.material}
            </p>
          )}

          {/* Price */}
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900">
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: product.currency || 'USD',
              }).format(product.price)}
            </span>
          </div>

          {/* CTA Button */}
          <button
            disabled={isOutOfStock}
            className={`mt-4 w-full py-2 px-4 text-sm font-semibold rounded transition-colors ${
              isOutOfStock
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-accent text-primary-dark hover:bg-accent-light'
            }`}
          >
            {isOutOfStock ? 'Out of Stock' : isPreorder ? 'Pre-order' : 'View Details'}
          </button>
        </div>
      </div>
    </Link>
  );
}
