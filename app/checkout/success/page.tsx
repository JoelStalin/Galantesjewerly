'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCart } from '@/context/shop/CartContext';

type CheckoutStatusResponse = {
  success?: boolean;
  paymentStatus?: string;
  order?: {
    id: number;
    name: string;
    date_order: string;
    amount_total: number;
    display_status: string;
    portal_url?: string | null;
    invoices?: Array<{
      id: number;
      name: string;
      invoice_date?: string | null;
      amount_total: number;
      display_status: string;
      pdf_url?: string | null;
      portal_url?: string | null;
    }>;
  } | null;
  invoice?: {
    id: number;
    name: string;
    invoice_date?: string | null;
    amount_total: number;
    display_status: string;
    pdf_url?: string | null;
    portal_url?: string | null;
  } | null;
  customerEmail?: string | null;
  error?: string;
};

function formatMoney(amount: number) {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function CheckoutSuccessPage() {
  const params = useSearchParams();
  const { clearCart } = useCart();
  const clearedCartRef = useRef(false);
  const clearCartActionRef = useRef(clearCart);
  const [status, setStatus] = useState<CheckoutStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const paymentIntent = params.get('payment_intent') || '';
  const paymentIntentClientSecret = params.get('payment_intent_client_secret') || '';

  useEffect(() => {
    clearCartActionRef.current = clearCart;
  }, [clearCart]);

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      if (!paymentIntent || !paymentIntentClientSecret) {
        setError('The payment confirmation details are missing.');
        setLoading(false);
        return;
      }

      const attempts = 5;

      for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
          const response = await fetch(
            `/api/checkout/status?payment_intent=${encodeURIComponent(paymentIntent)}&payment_intent_client_secret=${encodeURIComponent(paymentIntentClientSecret)}`,
            { cache: 'no-store' },
          );
          const result: CheckoutStatusResponse = await response.json();

          if (!response.ok) {
            throw new Error(result.error || 'Could not resolve the payment result.');
          }

          if (cancelled) {
            return;
          }

          setStatus(result);

          if (result.paymentStatus === 'succeeded' && !clearedCartRef.current) {
            clearCartActionRef.current();
            clearedCartRef.current = true;
          }

          const invoiceReady = Boolean(result.invoice?.id || result.order?.invoices?.length);
          if (result.paymentStatus !== 'succeeded' || invoiceReady || attempt === attempts - 1) {
            setLoading(false);
            return;
          }

          await new Promise((resolve) => setTimeout(resolve, 2000));
        } catch (caughtError) {
          if (!cancelled) {
            setError(caughtError instanceof Error ? caughtError.message : 'Could not resolve the payment result.');
            setLoading(false);
          }
          return;
        }
      }
    }

    void loadStatus();

    return () => {
      cancelled = true;
    };
  }, [paymentIntent, paymentIntentClientSecret]);

  const primaryInvoice = useMemo(() => status?.invoice || status?.order?.invoices?.[0] || null, [status]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-28 text-center">
        <p data-testid="checkout-success-loading" className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">
          Confirming payment and preparing your order...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-28 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-red-600">Checkout confirmation error</p>
        <h1 className="mt-4 font-serif text-4xl text-primary">We could not load your order summary.</h1>
        <p className="mt-4 text-sm text-muted-foreground">{error}</p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link href="/account/orders" className="rounded-full bg-primary px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] text-white">
            Go to Orders
          </Link>
          <Link href="/shop" className="rounded-full border border-primary/15 px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-20">
      <div className="rounded-3xl border border-primary/10 bg-white/80 p-8 shadow-sm backdrop-blur-sm md:p-10">
        <p data-testid="checkout-success-state" className="text-xs font-bold uppercase tracking-[0.24em] text-accent">
          {status?.paymentStatus === 'succeeded' ? 'Payment received' : `Payment ${status?.paymentStatus || 'pending'}`}
        </p>
        <h1 data-testid="checkout-success-heading" className="mt-4 font-serif text-4xl text-primary md:text-5xl">
          {primaryInvoice ? 'Your invoice is ready.' : 'Your order has been created.'}
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
          {primaryInvoice
            ? 'The cart has been cleared and your official invoice is available below.'
            : 'The cart has been cleared. If the invoice is still being finalized in Odoo, your confirmed order is already available below.'}
        </p>
        {status?.customerEmail ? (
          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Customer email: {status.customerEmail}
          </p>
        ) : null}

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {status?.order ? (
            <div data-testid="checkout-success-order" className="rounded-2xl border border-primary/10 bg-primary/[0.03] p-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Order</p>
              <p className="mt-2 font-serif text-2xl text-primary">{status.order.name}</p>
              <p className="mt-2 text-sm text-muted-foreground">{status.order.display_status}</p>
              <p className="mt-4 text-2xl font-serif text-primary">${formatMoney(status.order.amount_total)}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/account/orders" className="rounded-full bg-primary px-5 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white">
                  View in My Orders
                </Link>
                {status.order.portal_url ? (
                  <a href={status.order.portal_url} target="_blank" rel="noopener noreferrer" className="rounded-full border border-primary/15 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                    Open in Odoo
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}

          {primaryInvoice ? (
            <div data-testid="checkout-success-invoice" className="rounded-2xl border border-accent/30 bg-accent/10 p-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Invoice</p>
              <p className="mt-2 font-serif text-2xl text-primary">{primaryInvoice.name}</p>
              <p className="mt-2 text-sm text-muted-foreground">{primaryInvoice.display_status}</p>
              <p className="mt-4 text-2xl font-serif text-primary">${formatMoney(primaryInvoice.amount_total)}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/account/invoices" className="rounded-full bg-primary px-5 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white">
                  View in My Invoices
                </Link>
                {(primaryInvoice.pdf_url || primaryInvoice.portal_url) ? (
                  <a
                    href={primaryInvoice.pdf_url || primaryInvoice.portal_url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-primary/15 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-primary"
                  >
                    Download Invoice
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
