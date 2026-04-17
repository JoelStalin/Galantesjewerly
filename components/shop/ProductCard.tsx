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
  const isPreorder = product.availability === 'preorder';

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigating to detail page
    e.stopPropagation();

    addItem({
      id: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      quantity: 1,
      image_url: product.imageUrl
    });
  };

  return (
    <Link href={`/shop/${product.slug}`}>
      <div className="group relative bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
        {/* ... (image container) */}
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

          <div className="absolute top-4 right-4">
            {isOutOfStock && <span className="bg-red-500 text-white text-xs font-semibold px-3 py-1 rounded">Out of Stock</span>}
            {isPreorder && <span className="bg-amber-500 text-white text-xs font-semibold px-3 py-1 rounded">Pre-order</span>}
            {product.availability === 'in_stock' && <span className="bg-green-500 text-white text-xs font-semibold px-3 py-1 rounded">In Stock</span>}
          </div>
        </div>

        <div className="p-4">
          {product.category && <p className="text-xs uppercase text-gray-500 font-semibold mb-2">{product.category}</p>}
          <h3 className="text-lg font-serif font-semibold text-gray-900 mb-2 line-clamp-2">{product.name}</h3>

          <div className="flex items-center justify-between mt-auto">
            <span className="text-xl font-bold text-gray-900">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: product.currency || 'USD' }).format(product.price)}
            </span>
          </div>

          <button
            onClick={handleAddToCart}
            disabled={isOutOfStock}
            className={`mt-4 w-full py-3 px-4 text-[11px] uppercase tracking-[0.1em] font-bold rounded transition-all duration-300 ${
              isOutOfStock
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-primary text-white hover:bg-accent hover:text-primary-dark shadow-sm hover:shadow-md'
            }`}
          >
            {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </Link>
  );
}
