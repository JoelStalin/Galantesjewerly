import { describe, it, expect } from 'vitest';

export type CartItem = {
  id: string;
  slug: string;
  name: string;
  price: number;
  quantity: number;
  stock?: number;
};

// Pure logic helper replicating CartContext & Cart Page clamping rules
export function clampCartAddItem(prevItems: CartItem[], newItem: CartItem): CartItem[] {
  const existing = prevItems.find((i) => i.id === newItem.id);
  const maxStock = newItem.stock !== undefined ? newItem.stock : (existing?.stock !== undefined ? existing.stock : 999);
  
  if (existing) {
    const targetQty = Math.min(existing.quantity + newItem.quantity, maxStock);
    return prevItems.map((i) =>
      i.id === newItem.id ? { ...i, quantity: targetQty, stock: maxStock } : i
    );
  }
  const initialQty = Math.min(newItem.quantity, maxStock);
  return [...prevItems, { ...newItem, quantity: initialQty }];
}

export function clampCartUpdateQuantity(prevItems: CartItem[], id: string, requestedQty: number): CartItem[] {
  if (requestedQty <= 0) {
    return prevItems.filter((i) => i.id !== id);
  }
  return prevItems.map((i) => {
    if (i.id === id) {
      const maxStock = i.stock !== undefined ? i.stock : 999;
      return { ...i, quantity: Math.min(requestedQty, maxStock) };
    }
    return i;
  });
}

describe('Cart Stock Clamping Logic (Preventive Use Cases)', () => {
  it('Use Case 1: Should clamp initial addition if requested quantity exceeds stock', () => {
    const item: CartItem = { id: 'p1', slug: 'gold-ring', name: 'Gold Ring', price: 100, quantity: 6, stock: 5 };
    const cart = clampCartAddItem([], item);

    expect(cart.length).toBe(1);
    expect(cart[0].quantity).toBe(5); // Clamped from 6 to 5
  });

  it('Use Case 2: Should clamp cumulative addition when adding items to existing cart', () => {
    const initialCart: CartItem[] = [
      { id: 'p1', slug: 'gold-ring', name: 'Gold Ring', price: 100, quantity: 4, stock: 5 }
    ];
    const itemToAdd: CartItem = { id: 'p1', slug: 'gold-ring', name: 'Gold Ring', price: 100, quantity: 2, stock: 5 };
    const updatedCart = clampCartAddItem(initialCart, itemToAdd);

    expect(updatedCart[0].quantity).toBe(5); // 4 + 2 = 6, clamped to 5
  });

  it('Use Case 3: Should prevent updating quantity beyond available stock', () => {
    const initialCart: CartItem[] = [
      { id: 'p1', slug: 'gold-ring', name: 'Gold Ring', price: 100, quantity: 5, stock: 5 }
    ];
    const updatedCart = clampCartUpdateQuantity(initialCart, 'p1', 10);

    expect(updatedCart[0].quantity).toBe(5); // Clamped from 10 to 5
  });

  it('Use Case 4: Should allow valid quantity increases within stock boundaries', () => {
    const initialCart: CartItem[] = [
      { id: 'p1', slug: 'gold-ring', name: 'Gold Ring', price: 100, quantity: 2, stock: 5 }
    ];
    const updatedCart = clampCartUpdateQuantity(initialCart, 'p1', 4);

    expect(updatedCart[0].quantity).toBe(4);
  });

  it('Use Case 5: Should remove item when quantity is updated to 0 or negative', () => {
    const initialCart: CartItem[] = [
      { id: 'p1', slug: 'gold-ring', name: 'Gold Ring', price: 100, quantity: 2, stock: 5 }
    ];
    const updatedCart = clampCartUpdateQuantity(initialCart, 'p1', 0);

    expect(updatedCart.length).toBe(0);
  });
});
