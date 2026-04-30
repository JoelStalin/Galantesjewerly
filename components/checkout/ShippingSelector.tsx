'use client';

import React, { useState, useEffect } from 'react';
import { ShippingRate, ShippingAddress } from '@/lib/shipping/types';
import Link from 'next/link';

interface ShippingSelectorProps {
  address: ShippingAddress;
  orderValue: number;
  onRateSelect: (rate: ShippingRate) => void;
}

export function ShippingSelector({ address, orderValue, onRateSelect }: ShippingSelectorProps) {
  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [selectedRate, setSelectedRate] = useState<ShippingRate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRates = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/shipping/rates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address,
            packageDetails: { weightLbs: 1, value: orderValue }
          }),
        });
        const data = await res.json();
        if (data.success) {
          setRates(data.rates);
          const defaultRate = data.rates.find((rate: ShippingRate) => rate.carrier !== 'pickup') || data.rates[0] || null;
          if (defaultRate) {
            setSelectedRate(defaultRate);
            onRateSelect(defaultRate);
          }
        } else {
          setRates([]);
          setSelectedRate(null);
          setError(data.error || 'Unable to load shipping rates.');
        }
      } catch (error) {
        console.error('Failed to load shipping rates', error);
        setRates([]);
        setSelectedRate(null);
        setError('Unable to load shipping rates.');
      } finally {
        setLoading(false);
      }
    };

    if (address.zip && address.city) {
      fetchRates();
    }
  }, [address.zip, address.city, orderValue, onRateSelect]);

  const handleSelect = (rate: ShippingRate) => {
    setSelectedRate(rate);
    onRateSelect(rate);
  };

  if (loading) {
    return <div className="animate-pulse space-y-3"><div className="h-12 bg-primary/5 rounded-lg w-full"></div><div className="h-12 bg-primary/5 rounded-lg w-full"></div></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Delivery Method</h3>
        <span className="text-[10px] font-bold text-accent uppercase tracking-tighter bg-accent/10 px-2 py-0.5 rounded">
          Insurance Included
        </span>
      </div>

      <div className="grid gap-3">
        {rates.map((rate) => (
          <div
            key={`${rate.carrier}-${rate.serviceName}`}
            onClick={() => handleSelect(rate)}
            data-testid={`shipping-rate-${rate.carrier}`}
            className={`relative flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-all hover:shadow-sm ${
              selectedRate?.carrier === rate.carrier && selectedRate?.serviceName === rate.serviceName
                ? 'border-accent bg-accent/[0.03] ring-1 ring-accent'
                : 'border-primary/10 bg-white hover:border-primary/20'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="flex h-5 w-5 items-center justify-center rounded-full border border-primary/20 bg-white shadow-inner">
                {selectedRate?.carrier === rate.carrier && selectedRate?.serviceName === rate.serviceName && (
                  <div className="h-2.5 w-2.5 rounded-full bg-accent" />
                )}
              </div>
              <div>
                <p className="text-xs font-bold text-primary">{rate.serviceName}</p>
                <p className="text-[10px] text-muted-foreground">
                  {rate.carrier === 'pickup' 
                    ? 'Islamorada Boutique' 
                    : `Est. Delivery: ${rate.estimatedDays} business days`}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-serif font-bold text-primary">
                {rate.price === 0 ? 'FREE' : `$${rate.price.toFixed(2)}`}
              </p>
              {rate.price > 0 && (
                <p className="text-[9px] uppercase tracking-tighter text-muted-foreground">
                  Inc. ${rate.insuranceValue.toLocaleString()} Coverage
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-red-700">Shipping unavailable</p>
          <p className="mt-1 text-sm text-red-700">{error}</p>
        </div>
      )}

      {selectedRate?.carrier === 'pickup' && (
        <div className="rounded-xl border border-dashed border-accent/40 bg-accent/[0.02] p-4 animate-in fade-in slide-in-from-top-2 duration-300">
           <p className="text-[11px] text-primary/70 leading-relaxed italic mb-3">
             For local pick-up, we require a scheduled security window to ensure your piece is ready and authenticated.
           </p>
           <Link 
             href="/appointments?reason=pickup"
             target="_blank"
             className="inline-flex items-center text-[10px] font-bold uppercase tracking-widest text-accent hover:underline"
           >
             Schedule Collection Appointment →
           </Link>
        </div>
      )}
    </div>
  );
}
