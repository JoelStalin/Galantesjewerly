'use client';

import React, { useState } from 'react';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

interface CheckoutFormProps {
  customerData: {
    name: string;
    email: string;
    phone?: string;
  };
}

export function CheckoutForm({ customerData }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();

  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setIsLoading(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/success`,
        receipt_email: customerData.email,
      },
    });

    if (error.type === "card_error" || error.type === "validation_error") {
      setMessage(error.message ?? "An unexpected error occurred.");
    } else {
      setMessage("An unexpected error occurred.");
    }

    setIsLoading(false);
  };

  return (
    <form id="payment-form" onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement id="payment-element" options={{ layout: 'tabs' }} />

      <button
        disabled={isLoading || !stripe || !elements}
        id="submit"
        className="w-full bg-primary text-white py-4 uppercase tracking-widest text-xs font-bold hover:bg-primary-dark transition-colors disabled:opacity-50"
      >
        <span id="button-text">
          {isLoading ? "Processing..." : "Pay Now"}
        </span>
      </button>

      {message && <div id="payment-message" className="text-red-600 text-sm mt-4 text-center font-semibold">{message}</div>}
    </form>
  );
}
