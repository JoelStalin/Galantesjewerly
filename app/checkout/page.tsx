'use client';

import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { useCart } from '@/context/shop/CartContext';
import { CheckoutForm } from '@/components/checkout/CheckoutForm';
import Link from 'next/link';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function CheckoutPage() {
  const { items, totalCount } = useCart();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isReadyForPayment, setIsReadyForPayment] = useState(false);
  const [customerData, setCustomerData] = useState({
    name: '',
    email: '',
    phone: '',
    street: '',
    city: '',
    zip: '',
  });

  const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);

  const handleStartPayment = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Basic validation (Analista Funcional)
    if (!customerData.email || !customerData.name) {
      alert("Please provide at least name and email.");
      return;
    }

    try {
      const response = await fetch('/api/checkout/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, customerData }),
      });

      const data = await response.json();
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
        setIsReadyForPayment(true);
      } else {
        throw new Error(data.error || "Failed to initiate checkout");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to initiate checkout';
      console.error(error);
      alert(message);
    }
  };

  if (totalCount === 0) {
    return (
      <div className="mx-auto max-w-4xl py-32 px-6 text-center">
        <h1 className="text-4xl font-serif mb-6">Your Cart is Empty</h1>
        <Link href="/shop" className="underline">Go back to shop</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl py-20 px-6 grid grid-cols-1 lg:grid-cols-2 gap-16">
      <div>
        <h1 className="text-4xl font-serif mb-8 text-primary">Checkout</h1>

        {!isReadyForPayment ? (
          <form onSubmit={handleStartPayment} className="space-y-6 bg-white p-8 border border-primary/10 rounded-lg">
            <h2 className="text-xl font-serif mb-4">Contact Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text" placeholder="Full Name" required
                className="p-3 border rounded"
                value={customerData.name} onChange={e => setCustomerData({...customerData, name: e.target.value})}
              />
              <input
                type="email" placeholder="Email Address" required
                className="p-3 border rounded"
                value={customerData.email} onChange={e => setCustomerData({...customerData, email: e.target.value})}
              />
            </div>

            <h2 className="text-xl font-serif mt-8 mb-4">Shipping Address (USA Only)</h2>
            <div className="space-y-4">
              <input
                type="text" placeholder="Street Address" required
                className="w-full p-3 border rounded"
                value={customerData.street} onChange={e => setCustomerData({...customerData, street: e.target.value})}
              />
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text" placeholder="City" required
                  className="p-3 border rounded"
                  value={customerData.city} onChange={e => setCustomerData({...customerData, city: e.target.value})}
                />
                <input
                  type="text" placeholder="Zip Code" required
                  className="p-3 border rounded"
                  value={customerData.zip} onChange={e => setCustomerData({...customerData, zip: e.target.value})}
                />
              </div>
            </div>

            <button type="submit" className="w-full bg-primary text-white py-4 uppercase tracking-widest text-xs font-bold hover:bg-primary-dark transition-colors mt-8">
              Continue to Payment
            </button>
          </form>
        ) : clientSecret ? (
          <div className="bg-white p-8 border border-primary/10 rounded-lg shadow-sm">
            <h2 className="text-2xl font-serif mb-8 text-primary">Payment Details</h2>
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <CheckoutForm customerData={customerData} />
            </Elements>
            <button
              onClick={() => setIsReadyForPayment(false)}
              className="mt-6 text-sm text-gray-500 underline"
            >
              Edit shipping info
            </button>
          </div>
        ) : null}
      </div>

      {/* Summary Sidebar */}
      <div className="bg-primary/5 p-8 rounded-lg h-fit border border-primary/10">
        <h2 className="text-2xl font-serif mb-6 text-primary">Order Summary</h2>
        <div className="space-y-6 mb-8 max-h-[400px] overflow-y-auto pr-4">
          {items.map(item => (
            <div key={item.id} className="flex justify-between items-center text-sm">
              <div className="flex gap-4 items-center">
                <div className="w-12 h-12 bg-gray-100 rounded relative overflow-hidden">
                  {item.image_url && <img src={item.image_url} className="object-cover w-full h-full" />}
                </div>
                <span>{item.name} <span className="text-gray-400">x{item.quantity}</span></span>
              </div>
              <span className="font-bold">${(item.price * item.quantity).toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-primary/10 pt-6 space-y-4">
          <div className="flex justify-between">
            <span className="text-gray-600">Subtotal</span>
            <span className="font-bold">${subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xl font-bold border-t border-primary/10 pt-4">
            <span>Total (Estimated)</span>
            <span>${subtotal.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
