import { cookies } from 'next/headers';
import Link from 'next/link';
import { getAuthenticatedCustomerFromCookies } from '@/lib/customer-auth';
import { OdooService } from '@/lib/odoo/services';

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const cookieStore = await cookies();
  const user = await getAuthenticatedCustomerFromCookies(cookieStore);
  if (!user) return null;

  const order = await OdooService.getOrderFullDetails(parseInt(resolvedParams.id, 10), user.email);
  if (!order) return <div className="p-20 text-center">Order not found</div>;

  const statusColors: Record<string, string> = {
    'Confirmed': 'bg-green-100 text-green-700',
    'Cancelled': 'bg-red-100 text-red-700',
    'Quotation': 'bg-amber-100 text-amber-700',
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col gap-4 border-b border-primary/10 pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/account/orders" className="mb-2 inline-flex items-center text-xs font-bold uppercase tracking-widest text-accent hover:underline">
            ← Back to Orders
          </Link>
          <h1 className="font-serif text-4xl text-primary">{order.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Placed on {new Date(order.date_order).toLocaleDateString()}</p>
        </div>
        <div className={`inline-flex rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest ${statusColors[order.display_status] || 'bg-primary/5 text-primary'}`}>
          {order.display_status}
        </div>
      </div>

      {/* Tracking / Timeline */}
      {order.tracking && order.tracking.length > 0 && (
        <section className="rounded-2xl border border-primary/10 bg-primary/[0.01] p-6 sm:p-8">
          <h2 className="mb-6 font-serif text-xl text-primary">Shipping Status</h2>
          <div className="relative space-y-8 before:absolute before:left-3 before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-primary/10">
            {order.tracking.map((t: any, idx: number) => (
              <div key={t.id} className="relative pl-10">
                <div className={`absolute left-0 top-1 h-6 w-6 rounded-full border-4 border-white shadow-sm ${t.state === 'done' ? 'bg-green-500' : 'bg-accent'}`} />
                <div>
                  <p className="text-sm font-bold text-primary">{t.state === 'done' ? 'Delivered' : 'In Transit'}</p>
                  <p className="text-xs text-muted-foreground">{t.carrier_name} — Tracking: <span className="font-mono font-medium text-primary">{t.carrier_tracking_ref || 'Pending'}</span></p>
                  {t.date_done && <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground/60">{new Date(t.date_done).toLocaleString()}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Order Items */}
      <section className="space-y-6">
        <h2 className="font-serif text-2xl text-primary">Order Items</h2>
        <div className="divide-y divide-primary/5 rounded-2xl border border-primary/10 bg-white">
          {order.lines.map((line: any) => (
            <div key={line.id} className="flex gap-6 p-6">
              <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-zinc-50 border border-primary/5">
                <img src={line.image_url} alt={line.name} className="h-full w-full object-cover" />
              </div>
              <div className="flex flex-1 flex-col justify-between py-1">
                <div>
                  <h3 className="text-sm font-bold text-primary">{line.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Quantity: {line.product_uom_qty}</p>
                </div>
                <div className="text-sm font-medium text-primary">
                  ${parseFloat(line.price_unit).toLocaleString()} <span className="ml-2 text-xs font-normal text-muted-foreground">per unit</span>
                </div>
              </div>
              <div className="text-right py-1">
                <p className="text-sm font-serif font-bold text-primary">${parseFloat(line.price_total).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Summary */}
      <div className="grid gap-8 lg:grid-cols-2">
        <section className="rounded-2xl border border-primary/10 p-8">
          <h2 className="mb-4 font-serif text-lg text-primary">Delivery Address</h2>
          <div className="text-sm text-muted-foreground leading-relaxed">
             {/* Odoo partner_shipping_id is an array [id, name] or we can fetch full address if needed. 
                 For now, we assume simple address display from the order record if available or generic */}
             <p className="font-medium text-primary">Shipping destination linked to this order.</p>
             <p>Consult the official Odoo portal for full document details.</p>
             {order.portal_url && (
               <a href={order.portal_url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-xs font-bold uppercase tracking-widest text-accent hover:underline">
                 View Official Invoice →
               </a>
             )}
          </div>
        </section>

        <section className="rounded-2xl bg-primary/5 p-8">
          <h2 className="mb-6 font-serif text-lg text-primary">Order Summary</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-primary">${parseFloat(order.amount_untaxed).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Taxes</span>
              <span className="text-primary">${parseFloat(order.amount_tax).toLocaleString()}</span>
            </div>
            <div className="border-t border-primary/10 pt-3 flex justify-between font-serif text-xl">
              <span className="text-primary">Total</span>
              <span className="text-accent">${parseFloat(order.amount_total).toLocaleString()}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
