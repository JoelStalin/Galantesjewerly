'use client';

import { useState, useEffect } from 'react';

interface Address {
  id: number;
  name: string;
  type: 'delivery' | 'invoice' | 'other';
  phone?: string;
  street: string;
  street2?: string;
  city: string;
  zip: string;
  state_id?: [number, string];
  country_id?: [number, string];
}

export function AddressBook() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Address> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchAddresses();
  }, []);

  const fetchAddresses = async () => {
    try {
      const res = await fetch('/api/account/addresses');
      const data = await res.json();
      setAddresses(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch addresses', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setIsSaving(true);

    try {
      const res = await fetch('/api/account/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      });

      if (res.ok) {
        setEditing(null);
        fetchAddresses();
      }
    } catch (error) {
      console.error('Failed to save address', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to remove this address?')) return;
    
    try {
      const res = await fetch(`/api/account/addresses?id=${id}`, { method: 'DELETE' });
      if (res.ok) fetchAddresses();
    } catch (error) {
      console.error('Failed to delete address', error);
    }
  };

  const inputClass = 'w-full rounded-lg border border-primary/15 bg-white px-4 py-2.5 text-sm text-primary placeholder:text-muted-foreground/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors';
  const labelClass = 'mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground';

  if (loading) {
    return <div className="animate-pulse space-y-4"><div className="h-20 bg-primary/5 rounded-xl"></div><div className="h-20 bg-primary/5 rounded-xl"></div></div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl text-primary">Your Addresses</h2>
        <button 
          onClick={() => setEditing({ type: 'delivery', name: '', street: '', city: '', zip: '' })}
          className="text-xs font-bold uppercase tracking-widest text-accent hover:text-accent-dark transition-colors"
        >
          + Add New Address
        </button>
      </div>

      {editing && (
        <div className="rounded-2xl border border-accent/20 bg-accent/[0.02] p-6 animate-in fade-in slide-in-from-top-4 duration-300">
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelClass}>Address Label (e.g. Home, Office)</label>
                <input required className={inputClass} value={editing.name} onChange={e => setEditing({...editing, name: e.target.value})} placeholder="Main Residence" />
              </div>
              <div>
                <label className={labelClass}>Type</label>
                <select className={inputClass} value={editing.type} onChange={e => setEditing({...editing, type: e.target.value as any})}>
                  <option value="delivery">Shipping Address</option>
                  <option value="invoice">Billing Address</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Phone (Optional)</label>
                <input className={inputClass} value={editing.phone || ''} onChange={e => setEditing({...editing, phone: e.target.value})} placeholder="+1 (305) 555-0199" />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Street Address</label>
                <input required className={inputClass} value={editing.street} onChange={e => setEditing({...editing, street: e.target.value})} placeholder="82681 Overseas Highway" />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Apt / Suite / Unit</label>
                <input className={inputClass} value={editing.street2 || ''} onChange={e => setEditing({...editing, street2: e.target.value})} placeholder="Suite 101" />
              </div>
              <div>
                <label className={labelClass}>City</label>
                <input required className={inputClass} value={editing.city} onChange={e => setEditing({...editing, city: e.target.value})} placeholder="Islamorada" />
              </div>
              <div>
                <label className={labelClass}>ZIP Code</label>
                <input required className={inputClass} value={editing.zip} onChange={e => setEditing({...editing, zip: e.target.value})} placeholder="33036" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button disabled={isSaving} type="submit" className="rounded-full bg-accent px-6 py-2 text-xs font-bold uppercase tracking-widest text-primary hover:bg-accent-dark transition-all">
                {isSaving ? 'Saving...' : 'Save Address'}
              </button>
              <button type="button" onClick={() => setEditing(null)} className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {addresses.length === 0 ? (
          <div className="sm:col-span-2 rounded-xl border border-dashed border-primary/20 p-12 text-center">
            <p className="text-sm text-muted-foreground italic">No secondary addresses found.</p>
          </div>
        ) : (
          addresses.map(addr => (
            <div key={addr.id} className="group relative rounded-xl border border-primary/10 bg-white p-5 transition-all hover:border-accent/40 hover:shadow-md">
              <div className="mb-3 flex items-center justify-between">
                <span className="rounded-full bg-primary/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-primary/60">
                  {addr.type}
                </span>
                <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setEditing(addr)} className="text-xs font-semibold text-accent hover:underline">Edit</button>
                  <button onClick={() => handleDelete(addr.id)} className="text-xs font-semibold text-red-500 hover:underline">Delete</button>
                </div>
              </div>
              <h3 className="font-serif text-lg text-primary">{addr.name}</h3>
              <div className="mt-2 space-y-0.5 text-sm text-muted-foreground">
                <p>{addr.street}</p>
                {addr.street2 && <p>{addr.street2}</p>}
                <p>{addr.city}, {addr.zip}</p>
                {addr.phone && <p className="mt-2 text-xs font-medium text-primary/70">{addr.phone}</p>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
