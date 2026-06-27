'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { useCart } from '@/context/shop/CartContext';
import { CheckoutForm } from '@/components/checkout/CheckoutForm';
import Link from 'next/link';
import { ShippingSelector } from '@/components/checkout/ShippingSelector';
import type { ShippingRate } from '@/lib/shipping/types';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder');

type DeliveryMethod = 'ship' | 'pickup';

type CheckoutCustomerData = {
  name: string;
  email: string;
  phone: string;
  street: string;
  street2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
};

type SavedAddress = {
  id: number | string;
  name?: string;
  type?: 'delivery' | 'invoice' | 'other';
  phone?: string;
  street?: string;
  street2?: string;
  city?: string;
  zip?: string;
  state_id?: [number, string];
  country_id?: [number, string];
  source?: 'profile' | 'address';
};

const PICKUP_RATE: ShippingRate = {
  carrier: 'pickup',
  serviceName: 'Boutique Pick-up (Islamorada)',
  price: 0,
  currency: 'USD',
  estimatedDays: 0,
  insuranceIncluded: true,
  insuranceValue: 0,
};

function addressLabel(address: SavedAddress) {
  if (address.source === 'profile') return 'Default profile address';
  if (address.name) return address.name;
  if (address.type === 'delivery') return 'Shipping address';
  if (address.type === 'invoice') return 'Billing address';
  return 'Saved address';
}

export default function CheckoutPage() {
  const { items, totalCount } = useCart();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isReadyForPayment, setIsReadyForPayment] = useState(false);
  const [customerData, setCustomerData] = useState<CheckoutCustomerData>({
    name: '',
    email: '',
    phone: '',
    street: '',
    street2: '',
    city: '',
    state: '',
    zip: '',
    country: 'United States',
  });
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('ship');
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('manual');
  const [accountStatus, setAccountStatus] = useState<'loading' | 'signed-in' | 'guest'>('loading');
  const [selectedShippingRate, setSelectedShippingRate] = useState<ShippingRate | null>(null);

  const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const shippingAddress = useMemo(() => ({
    street: customerData.street,
    city: customerData.city,
    state: customerData.state,
    zip: customerData.zip,
    country: customerData.country,
  }), [customerData.city, customerData.country, customerData.state, customerData.street, customerData.zip]);
  const shippingTotal = selectedShippingRate?.price || 0;
  const orderTotal = subtotal + shippingTotal;
  const hasShippingAddress = Boolean(customerData.street && customerData.city && customerData.zip);

  useEffect(() => {
    let cancelled = false;

    async function loadCustomerCheckoutData() {
      try {
        const [profileResponse, addressesResponse] = await Promise.all([
          fetch('/api/account/profile', { cache: 'no-store' }),
          fetch('/api/account/addresses', { cache: 'no-store' }),
        ]);

        if (cancelled) return;

        if (profileResponse.status === 401 && addressesResponse.status === 401) {
          setAccountStatus('guest');
          return;
        }

        setAccountStatus('signed-in');

        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          const profile = profileData.profile || {};
          setCustomerData((current) => ({
            ...current,
            name: current.name || profile.name || '',
            email: current.email || profile.email || '',
            phone: current.phone || profile.phone || '',
            street: current.street || profile.street || '',
            street2: current.street2 || profile.street2 || '',
            city: current.city || profile.city || '',
            state: current.state || profile.state_name || '',
            zip: current.zip || profile.zip || '',
            country: current.country || profile.country_name || 'United States',
          }));

          if (profile.street && profile.city && profile.zip) {
            setSavedAddresses((current) => [
              {
                id: 'profile',
                source: 'profile',
                name: 'Default profile address',
                phone: profile.phone,
                street: profile.street,
                street2: profile.street2,
                city: profile.city,
                zip: profile.zip,
                state_id: profile.state_id && profile.state_name ? [profile.state_id, profile.state_name] : undefined,
                country_id: profile.country_id && profile.country_name ? [profile.country_id, profile.country_name] : undefined,
              },
              ...current.filter((address) => address.id !== 'profile'),
            ]);
            setSelectedAddressId((current) => current === 'manual' ? 'profile' : current);
          }
        }

        if (addressesResponse.ok) {
          const addresses = await addressesResponse.json();
          if (Array.isArray(addresses)) {
            setSavedAddresses((current) => {
              const profileAddress = current.find((address) => address.id === 'profile');
              const nextAddresses = addresses.filter((address) => address?.street && address?.city && address?.zip);
              return profileAddress ? [profileAddress, ...nextAddresses] : nextAddresses;
            });
          }
        }
      } catch (error) {
        console.warn('Checkout account preload failed:', error);
        if (!cancelled) setAccountStatus('guest');
      }
    }

    void loadCustomerCheckoutData();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (deliveryMethod === 'pickup') {
      setSelectedShippingRate({ ...PICKUP_RATE, insuranceValue: subtotal });
    } else {
      setSelectedShippingRate(null);
    }
  }, [deliveryMethod, subtotal]);

  const handleRateSelect = useCallback((rate: ShippingRate) => {
    setSelectedShippingRate(rate);
  }, []);

  const applySavedAddress = useCallback((address: SavedAddress) => {
    setSelectedAddressId(String(address.id));
    setCustomerData((current) => ({
      ...current,
      phone: current.phone || address.phone || '',
      street: address.street || '',
      street2: address.street2 || '',
      city: address.city || '',
      state: address.state_id?.[1] || '',
      zip: address.zip || '',
      country: address.country_id?.[1] || 'United States',
    }));
  }, []);

  const updateDeliveryMethod = useCallback((method: DeliveryMethod) => {
    setDeliveryMethod(method);
    setIsReadyForPayment(false);
  }, []);

  const useManualAddress = useCallback(() => {
    setSelectedAddressId('manual');
    setCustomerData((current) => ({
      ...current,
      street: '',
      street2: '',
      city: '',
      state: '',
      zip: '',
      country: 'United States',
    }));
  }, []);

  const handleStartPayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerData.email || !customerData.name) {
      alert("Please provide at least name and email.");
      return;
    }

    if (deliveryMethod === 'ship' && !hasShippingAddress) {
      alert('Please choose or enter a shipping address.');
      return;
    }

    if (!selectedShippingRate) {
      alert(deliveryMethod === 'pickup' ? 'Please choose a fulfillment option.' : 'Please choose a shipping method.');
      return;
    }

    try {
      const response = await fetch('/api/checkout/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, customerData, deliveryMethod, shippingRate: selectedShippingRate }),
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
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-6 py-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.75fr)] lg:gap-16">
      <div>
        <div className="mb-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-accent">Secure Checkout</p>
          <h1 className="mt-2 text-4xl font-serif text-primary">Choose how you receive your jewelry</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Signed-in customers can reuse saved addresses. Local customers can choose boutique pickup and skip shipping details.
          </p>
        </div>

        {!isReadyForPayment ? (
          <form onSubmit={handleStartPayment} className="space-y-8 rounded-[2rem] border border-primary/10 bg-white p-6 shadow-sm md:p-8">
            <section className="space-y-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-xl font-serif text-primary">Contact Information</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {accountStatus === 'signed-in'
                      ? 'We filled in what we know from your account. You can edit it for this order.'
                      : accountStatus === 'loading'
                        ? 'Checking for your saved account details...'
                        : 'Checking out as guest. Sign in to reuse saved addresses.'}
                  </p>
                </div>
                {accountStatus === 'guest' && (
                  <Link href="/auth/login?returnTo=/checkout" className="text-xs font-bold uppercase tracking-widest text-accent hover:underline">
                    Sign in
                  </Link>
                )}
              </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <input
                type="text" placeholder="Full Name" required
                data-testid="checkout-name"
                className="rounded-xl border border-primary/10 p-3 outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
                value={customerData.name} onChange={e => setCustomerData({...customerData, name: e.target.value})}
              />
              <input
                type="email" placeholder="Email Address" required
                data-testid="checkout-email"
                className="rounded-xl border border-primary/10 p-3 outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
                value={customerData.email} onChange={e => setCustomerData({...customerData, email: e.target.value})}
              />
              <input
                type="tel" placeholder="Phone Number"
                data-testid="checkout-phone"
                className="rounded-xl border border-primary/10 p-3 outline-none transition focus:border-accent focus:ring-1 focus:ring-accent md:col-span-2"
                value={customerData.phone} onChange={e => setCustomerData({...customerData, phone: e.target.value})}
              />
            </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-serif text-primary">Fulfillment</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {([
                  ['ship', 'Ship insured', 'Secure carrier delivery with insured rates.'],
                  ['pickup', 'Boutique pickup', 'Pick up in Islamorada by appointment.'],
                ] as const).map(([method, title, description]) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => updateDeliveryMethod(method)}
                    data-testid={`delivery-method-${method}`}
                    className={`rounded-2xl border p-4 text-left transition ${
                      deliveryMethod === method
                        ? 'border-accent bg-accent/[0.04] ring-1 ring-accent'
                        : 'border-primary/10 bg-primary/[0.015] hover:border-primary/25'
                    }`}
                  >
                    <span className="text-sm font-bold uppercase tracking-widest text-primary">{title}</span>
                    <span className="mt-2 block text-xs leading-5 text-muted-foreground">{description}</span>
                  </button>
                ))}
              </div>
            </section>

            {deliveryMethod === 'ship' ? (
              <section className="space-y-5">
                <div>
                  <h2 className="text-xl font-serif text-primary">Shipping Address</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Choose a saved address or enter a new one for this order.</p>
                </div>

                {savedAddresses.length > 0 && (
                  <div className="grid gap-3 md:grid-cols-2">
                    {savedAddresses.map((address) => (
                      <button
                        key={address.id}
                        type="button"
                        onClick={() => applySavedAddress(address)}
                        data-testid={`checkout-address-${address.id}`}
                        className={`rounded-2xl border p-4 text-left transition ${
                          selectedAddressId === String(address.id)
                            ? 'border-accent bg-accent/[0.04] ring-1 ring-accent'
                            : 'border-primary/10 bg-white hover:border-primary/25'
                        }`}
                      >
                        <span className="text-xs font-bold uppercase tracking-widest text-primary">{addressLabel(address)}</span>
                        <span className="mt-2 block text-sm text-primary">{address.street}</span>
                        {address.street2 && <span className="block text-xs text-muted-foreground">{address.street2}</span>}
                        <span className="block text-xs text-muted-foreground">{address.city}, {address.state_id?.[1] || ''} {address.zip}</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={useManualAddress}
                      className={`rounded-2xl border border-dashed p-4 text-left transition ${
                        selectedAddressId === 'manual'
                          ? 'border-accent bg-accent/[0.04] ring-1 ring-accent'
                          : 'border-primary/10 hover:border-primary/25'
                      }`}
                    >
                      <span className="text-xs font-bold uppercase tracking-widest text-primary">Use a new address</span>
                      <span className="mt-2 block text-xs text-muted-foreground">Enter or adjust the delivery address below.</span>
                    </button>
                  </div>
                )}

              <div className="space-y-4">
                <input
                  type="text" placeholder="Street Address" required={deliveryMethod === 'ship'}
                  data-testid="checkout-street"
                  className="w-full rounded-xl border border-primary/10 p-3 outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
                  value={customerData.street} onChange={e => setCustomerData({...customerData, street: e.target.value})}
                />
                <input
                  type="text" placeholder="Apt / Suite / Unit (optional)"
                  data-testid="checkout-street2"
                  className="w-full rounded-xl border border-primary/10 p-3 outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
                  value={customerData.street2} onChange={e => setCustomerData({...customerData, street2: e.target.value})}
                />
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text" placeholder="City" required={deliveryMethod === 'ship'}
                  data-testid="checkout-city"
                  className="rounded-xl border border-primary/10 p-3 outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
                  value={customerData.city} onChange={e => setCustomerData({...customerData, city: e.target.value})}
                />
                <input
                  type="text" placeholder="Zip Code" required={deliveryMethod === 'ship'}
                  data-testid="checkout-zip"
                  className="rounded-xl border border-primary/10 p-3 outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
                  value={customerData.zip} onChange={e => setCustomerData({...customerData, zip: e.target.value})}
                />
                <input
                  type="text" placeholder="State"
                  data-testid="checkout-state"
                  className="rounded-xl border border-primary/10 p-3 outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
                  value={customerData.state} onChange={e => setCustomerData({...customerData, state: e.target.value})}
                />
                <input
                  type="text" placeholder="Country"
                  data-testid="checkout-country"
                  className="rounded-xl border border-primary/10 p-3 outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
                  value={customerData.country} onChange={e => setCustomerData({...customerData, country: e.target.value})}
                />
              </div>
            </div>

            <div className="pt-2">
              <ShippingSelector
                address={shippingAddress}
                orderValue={subtotal}
                onRateSelect={handleRateSelect}
                excludePickup
              />
            </div>
              </section>
            ) : (
              <section className="rounded-2xl border border-accent/30 bg-accent/[0.035] p-5">
                <h2 className="text-xl font-serif text-primary">Boutique Pickup</h2>
                <p className="mt-2 text-sm leading-6 text-primary/70">
                  No shipping address needed. After payment, our team will prepare the piece and coordinate a secure pickup window at the Islamorada boutique.
                </p>
                <Link
                  href="/contact"
                  className="mt-4 inline-flex text-xs font-bold uppercase tracking-widest text-accent hover:underline"
                >
                  Need a specific pickup time?
                </Link>
              </section>
            )}

            <button
              type="submit"
              disabled={!selectedShippingRate}
              data-testid="checkout-continue"
              className="mt-2 w-full rounded-full bg-primary py-4 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-primary/40"
            >
              {!selectedShippingRate
                ? deliveryMethod === 'pickup' ? 'Choose Pickup' : 'Select Shipping Method'
                : 'Continue to Payment'}
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
                <div className="relative h-12 w-12 overflow-hidden rounded bg-gray-100">
                  {item.image_url && (
                    // Product images are served through a local API query string; next/image localPatterns intentionally block broad query optimization.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                  )}
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
          <div className="flex justify-between">
            <span className="text-gray-600">Shipping</span>
            <span className="font-bold" data-testid="checkout-shipping-total">
              {selectedShippingRate ? (shippingTotal === 0 ? 'FREE' : `$${shippingTotal.toFixed(2)}`) : 'Choose at checkout'}
            </span>
          </div>
          <div className="flex justify-between text-xl font-bold border-t border-primary/10 pt-4">
            <span>Total (Estimated)</span>
            <span data-testid="checkout-total">${orderTotal.toLocaleString(undefined, { minimumFractionDigits: selectedShippingRate ? 2 : 0, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
