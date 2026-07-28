import { describe, expect, it } from 'vitest';
import { validateCartForCheckout } from '@/lib/cart-policy';

const stock = [
  { productId: 10, stock: 3, price: 100 },
  { productId: 11, stock: 1, price: 250 },
];

describe('cart checkout policy', () => {
  it.each([
    ['empty cart', []],
    ['missing product id', [{ quantity: 1 }]],
    ['zero id', [{ productId: 0, quantity: 1 }]],
    ['negative id', [{ productId: -1, quantity: 1 }]],
    ['decimal id', [{ productId: 1.5, quantity: 1 }]],
    ['zero quantity', [{ productId: 10, quantity: 0 }]],
    ['negative quantity', [{ productId: 10, quantity: -1 }]],
    ['decimal quantity', [{ productId: 10, quantity: 1.5 }]],
    ['NaN quantity', [{ productId: 10, quantity: Number.NaN }]],
    ['infinite quantity', [{ productId: 10, quantity: Number.POSITIVE_INFINITY }]],
  ])('rejects %s', (_, items) => expect(() => validateCartForCheckout(items, stock)).toThrow());

  it('rejects a product that disappeared from inventory', () => {
    expect(() => validateCartForCheckout([{ productId: 99, quantity: 1 }], stock)).toThrow(/no longer available/);
  });

  it('rejects quantity above available stock', () => {
    expect(() => validateCartForCheckout([{ productId: 10, quantity: 4 }], stock)).toThrow(/Insufficient stock/);
  });

  it('allows exactly the available stock', () => {
    expect(validateCartForCheckout([{ productId: 10, quantity: 3 }], stock).total).toBe(300);
  });

  it('rejects duplicate product lines to prevent quantity bypass', () => {
    expect(() => validateCartForCheckout([
      { productId: 10, quantity: 2 },
      { productId: 10, quantity: 2 },
    ], stock)).toThrow(/more than once/);
  });

  it('uses server prices instead of client prices', () => {
    const result = validateCartForCheckout([{ productId: 10, quantity: 2, clientPrice: 0.01 }], stock);
    expect(result.total).toBe(200);
    expect(result.items[0].price).toBe(100);
  });

  it('calculates a multi-product total from server snapshots', () => {
    expect(validateCartForCheckout([
      { productId: 10, quantity: 2 },
      { productId: 11, quantity: 1 },
    ], stock).total).toBe(450);
  });

  it('rejects negative or invalid server stock and prices', () => {
    expect(() => validateCartForCheckout([{ productId: 10, quantity: 1 }], [{ productId: 10, stock: -1, price: 100 }])).toThrow();
    expect(() => validateCartForCheckout([{ productId: 10, quantity: 1 }], [{ productId: 10, stock: 1, price: Number.NaN }])).toThrow();
  });

  it('accepts numeric string IDs from the browser', () => {
    expect(validateCartForCheckout([{ productId: '10', quantity: 1 }], stock).items[0].productId).toBe(10);
  });

  it('keeps zero-price products valid but never negative', () => {
    expect(validateCartForCheckout([{ productId: 10, quantity: 1 }], [{ productId: 10, stock: 1, price: 0 }]).total).toBe(0);
  });
});
