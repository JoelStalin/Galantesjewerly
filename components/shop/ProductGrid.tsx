'use client';

import { ShopProduct } from '@/lib/odoo/client';
import { ProductCard } from './ProductCard';

interface ProductGridProps {
  products: ShopProduct[];
  isLoading?: boolean;
  columns?: 1 | 2 | 3 | 4;
}

export function ProductGrid({
  products,
  isLoading = false,
  columns = 3,
}: ProductGridProps) {
  const colsClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  }[columns];

  if (isLoading) {
    return (
      <div className={`grid ${colsClass} gap-6 auto-rows-max`}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-gray-200 rounded-lg h-96 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          No products found
        </h3>
        <p className="text-gray-600">
          Try adjusting your filters or browse our other collections.
        </p>
      </div>
    );
  }

  return (
    <div className={`grid ${colsClass} gap-6 auto-rows-max`}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
