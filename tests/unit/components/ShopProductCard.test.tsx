import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProductCard } from '@/components/shop/ProductCard';
import { CartProvider } from '@/context/shop/CartContext';
import type { ShopProduct } from '@/lib/odoo/client';

const mockProduct: ShopProduct = {
  id: '1',
  slug: 'gold-ring',
  name: 'Gold Ring',
  shortDescription: 'A radiant gold ring',
  longDescription: 'Modern gold ring with polished finish.',
  price: 1295,
  currency: 'USD',
  availability: 'in_stock',
  imageUrl: 'https://example.com/img.jpg',
  gallery: ['https://example.com/img.jpg'],
  sku: 'GR-001',
  material: '14k Gold',
  category: 'Rings',
  buyUrl: '/shop/gold-ring',
  publicUrl: '/shop/gold-ring',
};

describe('ProductCard', () => {
  it('renders product details with a link to the product detail page', () => {
    render(
      <CartProvider>
        <ProductCard product={mockProduct} />
      </CartProvider>,
    );

    expect(screen.getByRole('link', { name: /Gold Ring/i })).toHaveAttribute(
      'href',
      '/shop/gold-ring',
    );
    expect(screen.getByText('Gold Ring')).toBeInTheDocument();
    expect(screen.getByText('$1,295.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add to Cart/i })).toBeInTheDocument();
  });

  it('renders an out of stock badge when availability is out_of_stock', () => {
    render(
      <CartProvider>
        <ProductCard
          product={{
            ...mockProduct,
            availability: 'out_of_stock',
            name: 'Gold Ring Out of Stock',
          }}
        />
      </CartProvider>,
    );

    expect(screen.getAllByText('Out of Stock')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /Out of Stock/i })).toBeDisabled();
  });
});
