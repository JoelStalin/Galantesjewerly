'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/context/shop/CartContext';

export default function CartPage() {
  const { items, removeItem, updateQuantity, totalCount } = useCart();

  const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);

  if (totalCount === 0) {
    return (
      <div className="mx-auto max-w-4xl py-32 px-6 text-center">
        <h1 className="text-4xl font-serif mb-6">Your Cart is Empty</h1>
        <p className="text-gray-600 mb-10">Discover our coastal collection and find your next treasure.</p>
        <Link href="/shop" className="bg-primary text-white px-8 py-4 uppercase tracking-widest text-sm font-bold hover:bg-primary-dark transition-colors">
          Explore Shop
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl py-20 px-6">
      <h1 className="text-5xl font-serif mb-12">Shopping Cart</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
        {/* Item List */}
        <div className="lg:col-span-2 space-y-8">
          {items.map((item) => (
            <div key={item.id} className="flex gap-6 border-b border-primary/10 pb-8">
              <div className="relative h-32 w-32 flex-shrink-0 bg-gray-50 overflow-hidden rounded">
                {item.image_url && (
                  <Image src={item.image_url} alt={item.name} fill className="object-cover" />
                )}
              </div>
              <div className="flex flex-grow flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <h3 className="text-xl font-serif text-primary">{item.name}</h3>
                    <p className="text-lg font-bold">${(item.price * item.quantity).toLocaleString()}</p>
                  </div>
                  <p className="text-sm text-gray-500 uppercase tracking-widest mt-1">Ref: {item.slug}</p>
                </div>

                <div className="flex justify-between items-end mt-4">
                  <div className="flex items-center border border-primary/20 rounded">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="px-3 py-1 hover:bg-gray-100 transition-colors border-r border-primary/20"
                    >-</button>
                    <span className="px-4 py-1 text-sm font-bold">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="px-3 py-1 hover:bg-gray-100 transition-colors border-l border-primary/20"
                    >+</button>
                  </div>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-xs uppercase tracking-widest text-red-600 hover:text-red-800 transition-colors font-bold"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Order Summary */}
        <div className="bg-primary/5 p-8 rounded-lg h-fit">
          <h2 className="text-2xl font-serif mb-6 text-primary">Order Summary</h2>
          <div className="space-y-4 text-sm border-b border-primary/10 pb-6 mb-6">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal ({totalCount} items)</span>
              <span className="font-bold">${subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Shipping</span>
              <span className="text-accent uppercase tracking-widest text-xs font-bold">Calculated at checkout</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Tax</span>
              <span className="text-accent uppercase tracking-widest text-xs font-bold">Calculated at checkout</span>
            </div>
          </div>
          <div className="flex justify-between text-xl font-bold mb-8">
            <span>Total</span>
            <span>${subtotal.toLocaleString()}</span>
          </div>

          <div className="space-y-4">
            <button className="w-full bg-primary text-white py-4 uppercase tracking-widest text-xs font-bold hover:bg-primary-dark transition-colors">
              Checkout with Stripe
            </button>
            <button className="w-full bg-black text-white py-4 flex items-center justify-center gap-2 rounded hover:opacity-90 transition-opacity">
              <span className="text-sm font-bold">Buy with</span>
              <span className="text-lg font-serif">Google Pay</span>
            </button>
          </div>
          <p className="text-[10px] text-gray-500 text-center mt-6 uppercase tracking-wider leading-relaxed">
            By proceeding, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
