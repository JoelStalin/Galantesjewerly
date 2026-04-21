import { cookies } from 'next/headers';
import { getAuthenticatedCustomerFromCookies } from '@/lib/customer-auth';
import { OdooService } from '@/lib/odoo/services';

const STATUS_STYLES: Record<string, string> = {
  sale:   'bg-green-50 text-green-700 border-green-100',
  done:   'bg-green-50 text-green-700 border-green-100',
  draft:  'bg-blue-50 text-blue-700 border-blue-100',
  sent:   'bg-blue-50 text-blue-700 border-blue-100',
  cancel: 'bg-red-50 text-red-600 border-red-100',
};
const STATUS_DOT: Record<string, string> = {
  sale:   'bg-green-600',
  done:   'bg-green-600',
  draft:  'bg-blue-600',
  sent:   'bg-blue-600',
  cancel: 'bg-red-500',
};
const INVOICE_STYLES: Record<string, string> = {
  paid:       'bg-green-50 text-green-700 border-green-100',
  in_payment: 'bg-blue-50 text-blue-700 border-blue-100',
  not_paid:   'bg-amber-50 text-amber-700 border-amber-100',
  partial:    'bg-amber-50 text-amber-700 border-amber-100',
};
const INVOICE_DOT: Record<string, string> = {
  paid:       'bg-green-600',
  in_payment: 'bg-blue-600',
  not_paid:   'bg-amber-500',
  partial:    'bg-amber-500',
};

export default async function OrdersPage() {
  const cookieStore = await cookies();
  const user = await getAuthenticatedCustomerFromCookies(cookieStore);
  if (!user) return null;

  const partnerId = await OdooService.getPartnerByEmail(user.email)
    || await OdooService.findOrCreateCustomer({
      name: user.name || user.username || user.email,
      email: user.email,
    });
  const orders = partnerId ? await OdooService.getOrdersWithInvoices(partnerId) : [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2 border-b border-primary/10 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-serif text-4xl text-primary">Order History</h1>
          <p className="text-sm text-muted-foreground mt-1">Track your coastal fine jewelry purchases and invoices.</p>
        </div>
        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{orders.length} orders total</span>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-6 rounded-full bg-primary/5 p-8">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={0.5} stroke="currentColor" className="h-16 w-16 text-primary/30">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.112 16.826a2.125 2.125 0 0 1-2.122 2.265H5.257a2.125 2.125 0 0 1-2.122-2.265l1.112-16.826a2.125 2.125 0 0 1 2.122-1.993h12.268a2.125 2.125 0 0 1 2.122 1.993Z" />
            </svg>
          </div>
          <p className="font-serif text-xl text-primary">Your jewelry box is currently empty.</p>
          <p className="mt-2 text-sm text-muted-foreground max-w-xs mx-auto">Discover our handcrafted nautical collections and begin your story with us.</p>
          <a href="/shop" className="mt-10 inline-flex items-center justify-center rounded-full border border-accent bg-accent px-8 py-3 text-xs font-bold uppercase tracking-[0.2em] text-primary-dark transition-all hover:bg-accent-light hover:shadow-lg">
            Browse Collections
          </a>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order: any) => (
            <div key={order.id} className="overflow-hidden rounded-xl border border-primary/10 bg-white/50 shadow-sm backdrop-blur-sm">
              {/* Order header */}
              <div className="flex flex-col gap-4 bg-primary/[0.03] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1">
                  <span className="font-serif text-lg text-primary leading-tight">{order.name}</span>
                  <span className="text-xs text-muted-foreground font-light">
                    {new Date(order.date_order).toLocaleDateString('en-US', {
                      month: 'long', day: 'numeric', year: 'numeric',
                    })}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLES[order.state] ?? 'bg-gray-50 text-gray-600 border-gray-100'}`}>
                    <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${STATUS_DOT[order.state] ?? 'bg-gray-500'}`} />
                    {order.display_status}
                  </span>

                  <span className="font-serif text-xl text-primary">
                    ${order.amount_total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Order actions */}
              {order.portal_url && (
                <div className="border-b border-primary/5 px-6 py-3">
                  <a
                    href={order.portal_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-accent transition-colors hover:text-accent-dark"
                  >
                    View Order in Odoo Portal
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                      <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                  </a>
                </div>
              )}

              {/* Attached invoices */}
              {order.invoices && order.invoices.length > 0 ? (
                <div className="px-6 py-4">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    Attached Invoices
                  </p>
                  <div className="space-y-2">
                    {order.invoices.map((inv: any) => (
                      <div key={inv.id} className="flex flex-col gap-2 rounded-lg border border-primary/5 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium text-primary">{inv.name}</span>
                          <span className="text-xs text-muted-foreground font-light">
                            {inv.invoice_date
                              ? new Date(inv.invoice_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                              : 'Pending date'}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${INVOICE_STYLES[inv.payment_state] ?? 'bg-gray-50 text-gray-600 border-gray-100'}`}>
                            <span className={`mr-1 h-1 w-1 rounded-full ${INVOICE_DOT[inv.payment_state] ?? 'bg-gray-500'}`} />
                            {inv.display_status}
                          </span>

                          <span className="font-serif text-base text-primary">
                            ${inv.amount_total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>

                          {inv.portal_url && (
                            <a
                              href={inv.portal_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-full border border-primary/15 bg-white px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-primary transition-colors hover:border-accent hover:text-accent"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="7 10 12 15 17 10"/>
                                <line x1="12" y1="15" x2="12" y2="3"/>
                              </svg>
                              Download PDF
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="px-6 py-4">
                  <p className="text-xs text-muted-foreground italic">No invoice attached yet.</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
