import { cookies } from 'next/headers';
import { verifyGoogleUserSession, GOOGLE_USER_COOKIE } from '@/lib/google-login';
import { OdooService } from '@/lib/odoo/services';

export default async function OrdersPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(GOOGLE_USER_COOKIE)?.value;

  if (!sessionToken) return null; // Handled by layout

  const user = await verifyGoogleUserSession(sessionToken);
  if (!user) return null;

  const partnerId = await OdooService.getPartnerByEmail(user.email);
  const orders = partnerId ? await OdooService.getPartnerOrders(partnerId) : [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2 border-b border-primary/10 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-serif text-4xl text-primary">Order History</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage and track your coastal fine jewelry purchases.</p>
        </div>
        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{orders.length} orders total</span>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-6 rounded-full bg-primary/5 p-8">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={0.5} stroke="currentColor" className="h-16 w-16 text-primary/30">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.112 16.826a2.125 2.125 0 0 1-2.122 2.265H5.257a2.125 2.125 0 0 1-2.122-2.265l1.112-16.826a2.125 2.125 0 0 1 2.122-1.993h12.268a2.125 2.125 0 0 1 2.122 1.993Zm-9.286-4.207V10.5A.75.75 0 0 1 9 11.25H6.75a.75.75 0 0 1-.75-.75V6.75a2.25 2.25 0 0 1 4.5 0Zm6.75 0V10.5a.75.75 0 0 1-.75.75H12.75a.75.75 0 0 1-.75-.75V6.75a2.25 2.25 0 0 1 4.5 0Z" />
            </svg>
          </div>
          <p className="font-serif text-xl text-primary">Your jewelry box is currently empty.</p>
          <p className="mt-2 text-sm text-muted-foreground max-w-xs mx-auto">Discover our handcrafted nautical collections and begin your story with us.</p>
          <a href="/shop" className="mt-10 inline-flex items-center justify-center rounded-full border border-accent bg-accent px-8 py-3 text-xs font-bold uppercase tracking-[0.2em] text-primary-dark transition-all hover:bg-accent-light hover:shadow-lg">
            Browse Collections
          </a>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-primary/5 bg-white/30 backdrop-blur-sm shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-primary/5 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              <tr>
                <th className="px-6 py-5 font-bold">Document</th>
                <th className="px-6 py-5 font-bold">Purchased On</th>
                <th className="px-6 py-5 font-bold">Status</th>
                <th className="px-6 py-5 font-bold text-right">Investment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/5">
              {orders.map((order: any) => (
                <tr key={order.id} className="group transition-colors hover:bg-primary/[0.02]">
                  <td className="px-6 py-8">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-primary tracking-tight">{order.name}</span>
                      {order.portal_url && (
                        <a 
                          href={order.portal_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-[9px] font-bold text-accent uppercase tracking-widest hover:text-accent-dark transition-colors flex items-center gap-1"
                        >
                          View Official Receipt
                          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-8 text-sm text-muted-foreground font-light">
                    {new Date(order.date_order).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </td>
                  <td className="px-6 py-8">
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
                      order.state === 'sale' 
                        ? 'bg-green-50 text-green-700 border border-green-100' 
                        : 'bg-blue-50 text-blue-700 border border-blue-100'
                    }`}>
                      <span className={`mr-1.5 h-1 w-1 rounded-full ${order.state === 'sale' ? 'bg-green-600' : 'bg-blue-600'}`} />
                      {order.display_status}
                    </span>
                  </td>
                  <td className="px-6 py-8 text-right">
                    <span className="font-serif text-xl text-primary">
                      ${order.amount_total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
