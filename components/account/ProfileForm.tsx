'use client';

import { useState } from 'react';

interface ProfileData {
  name: string;
  email: string;
  phone: string;
  street: string;
  street2: string;
  city: string;
  zip: string;
  state_id?: number;
  country_id?: number;
  state_name?: string;
  country_name?: string;
}

interface ProfileFormProps {
  initialData: ProfileData;
}

export function ProfileForm({ initialData }: ProfileFormProps) {
  const [form, setForm] = useState<ProfileData>(initialData);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.name === 'state_id' || e.target.name === 'country_id' 
      ? parseInt(e.target.value, 10) 
      : e.target.value;
    
    setForm(prev => ({ ...prev, [e.target.name]: value }));
    if (status !== 'idle') setStatus('idle');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('saving');
    setErrorMsg('');

    try {
      const res = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:       form.name,
          phone:      form.phone,
          street:     form.street,
          street2:    form.street2,
          city:       form.city,
          zip:        form.zip,
          state_id:   form.state_id,
          country_id: form.country_id,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Update failed');
      }

      setStatus('saved');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  const inputClass =
    'w-full rounded-lg border border-primary/15 bg-white px-4 py-3 text-sm text-primary placeholder:text-muted-foreground/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors';
  const labelClass = 'mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground';

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      {/* Personal info */}
      <section className="space-y-5">
        <h2 className="font-serif text-xl text-primary">Personal Information</h2>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="name" className={labelClass}>Full Name</label>
            <input
              id="name"
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange}
              required
              className={inputClass}
              placeholder="Your full name"
            />
          </div>

          <div>
            <label htmlFor="email" className={labelClass}>Email Address</label>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              disabled
              className={`${inputClass} cursor-not-allowed opacity-60`}
              title="Email is managed by Google — change it at myaccount.google.com"
            />
            <p className="mt-1 text-[10px] text-muted-foreground/70">Managed by Google — read only</p>
          </div>

          <div>
            <label htmlFor="phone" className={labelClass}>Phone Number</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              className={inputClass}
              placeholder="+1 (305) 555-0000"
            />
          </div>
        </div>
      </section>

      {/* Shipping address */}
      <section className="space-y-5">
        <h2 className="font-serif text-xl text-primary">Default Shipping Address</h2>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="street" className={labelClass}>Street Address</label>
            <input
              id="street"
              name="street"
              type="text"
              value={form.street}
              onChange={handleChange}
              className={inputClass}
              placeholder="123 Coastal Avenue"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="street2" className={labelClass}>Apt / Suite / Unit <span className="normal-case font-normal">(optional)</span></label>
            <input
              id="street2"
              name="street2"
              type="text"
              value={form.street2}
              onChange={handleChange}
              className={inputClass}
              placeholder="Suite 100"
            />
          </div>

          <div>
            <label htmlFor="city" className={labelClass}>City</label>
            <input
              id="city"
              name="city"
              type="text"
              value={form.city}
              onChange={handleChange}
              className={inputClass}
              placeholder="Islamorada"
            />
          </div>

          <div>
            <label htmlFor="zip" className={labelClass}>ZIP / Postal Code</label>
            <input
              id="zip"
              name="zip"
              type="text"
              value={form.zip}
              onChange={handleChange}
              className={inputClass}
              placeholder="33036"
            />
          </div>

          <div>
            <label htmlFor="country_id" className={labelClass}>Country</label>
            <select
              id="country_id"
              name="country_id"
              value={form.country_id || 233}
              onChange={handleChange}
              className={inputClass}
            >
              <option value={233}>United States</option>
              <option value={62}>Dominican Republic</option>
            </select>
          </div>

          <div>
            <label htmlFor="state_id" className={labelClass}>State / Province</label>
            <select
              id="state_id"
              name="state_id"
              value={form.state_id || ''}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="">Select State...</option>
              <option value={10}>Florida</option>
              <option value={33}>New York</option>
              <option value={5}>California</option>
              <option value={43}>Texas</option>
              {/* Odoo state IDs for common US states */}
            </select>
            {form.state_name && !form.state_id && (
               <p className="mt-1 text-[10px] text-muted-foreground">Current: {form.state_name}</p>
            )}
          </div>
        </div>
      </section>

      {/* Submit */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={status === 'saving'}
          className="inline-flex items-center justify-center rounded-full border border-accent bg-accent px-8 py-3 text-xs font-bold uppercase tracking-[0.2em] text-primary-dark transition-all hover:bg-accent-light hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {status === 'saving' ? (
            <>
              <svg className="mr-2 h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Saving…
            </>
          ) : 'Save Changes'}
        </button>

        {status === 'saved' && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-green-600">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd"/>
            </svg>
            Profile updated
          </span>
        )}

        {status === 'error' && (
          <span className="text-xs text-red-600">{errorMsg}</span>
        )}
      </div>
    </form>
  );
}
