'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  buildCartCookieAttributes,
  buildCartCookieValue,
  CART_COOKIE_KEY,
  CART_STORAGE_KEY,
  parseCartItems,
  readCartCookie,
  serializeCartItems,
} from '@/lib/cart-storage';

export type CartItem = {
  id: string;
  product_id?: string | number;
  slug: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string;
};

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalCount: number;
  hasHydrated: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hasHydrated, setHasHydrated] = useState(false);

  // Load cart from localStorage on init
  useEffect(() => {
    const savedLocalCart = localStorage.getItem(CART_STORAGE_KEY);
    const savedCookieCart = readCartCookie(document.cookie);
    const localItems = parseCartItems(savedLocalCart);
    const cookieItems = parseCartItems(savedCookieCart);
    const hydratedItems = localItems.length > 0 ? localItems : cookieItems;

    if (hydratedItems.length > 0) {
      setItems(hydratedItems);
    }
    setHasHydrated(true);
  }, []);

  // Save cart to localStorage on change
  useEffect(() => {
    if (!hasHydrated) {
      return;
    }
    const serialized = serializeCartItems(items);
    localStorage.setItem(CART_STORAGE_KEY, serialized);

    if (typeof document !== 'undefined') {
      document.cookie = `${CART_COOKIE_KEY}=${buildCartCookieValue(items)}; ${buildCartCookieAttributes()}`;
    }
  }, [hasHydrated, items]);

  const addItem = (newItem: CartItem) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === newItem.id);
      if (existing) {
        return prev.map((i) =>
          i.id === newItem.id ? { ...i, quantity: i.quantity + newItem.quantity } : i
        );
      }
      return [...prev, newItem];
    });
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(id);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quantity } : i))
    );
  };

  const clearCart = () => setItems([]);

  const totalCount = items.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, totalCount, hasHydrated }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
