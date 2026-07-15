import { cookies } from 'next/headers';
import { getAuthenticatedCustomerFromCookies } from '@/lib/customer-auth';
import { OdooService } from '@/lib/odoo/services';

export default async function InvoicesPage() {
  const cookieStore = await cookies();
  const user = await getAuthenticatedCustomerFromCookies(cookieStore);
  if (!user) return null;

  const partnerId = await OdooService.getPartnerByEmail(user.email)
    || await OdooService.findOrCreateCustomer({
      name: user.name || user.username || user.email,
      email: user.email,
    });
  const invoices = partnerId ? await OdooService.getPartnerInvoices(partnerId) : [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2 border-b border-primary/10 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-serif text-4xl text-primary">Invoices</h1>
          <p className="text-sm text-muted-foreground mt-1">Official billing documents and payment receipts.</p>
        </div>
        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{invoices.length} documents</span>
      </div>

      {invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-6 rounded-full bg-primary/5 p-8">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={0.5} stroke="currentColor" className="h-16 w-16 text-primary/30">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
          </div>
          <p className="font-serif text-xl text-primary">No invoices found.</p>
          <p className="mt-2 text-sm text-muted-foreground">Once you complete a purchase, your official receipts will appear here.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-primary/5 bg-white/30 backdrop-blur-sm shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-primary/5 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              <tr>
                <th className="px-6 py-5 font-bold">Invoice #</th>
                <th className="px-6 py-5 font-bold">Issue Date</th>
                <th className="px-6 py-5 font-bold">Status</th>
                <th className="px-6 py-5 font-bold text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/5">
              {invoices.map((inv: any) => (
                <tr key={inv.id} className="group transition-colors hover:bg-primary/[0.02]">
                  <td className="px-6 py-8">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-primary tracking-tight">{inv.name}</span>
                      {inv.portal_url && (
                        <a 
                          href={inv.portal_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-[9px] font-bold text-accent uppercase tracking-widest hover:text-accent-dark transition-colors flex items-center gap-1"
                        >
                          Download Official PDF
                          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-8 text-sm text-muted-foreground font-light">
                    {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    }) : 'Pending'}
                  </td>
                  <td className="px-6 py-8">
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
                      inv.payment_state === 'paid' 
                        ? 'bg-green-50 text-green-700 border border-green-100' 
                        : 'bg-amber-50 text-amber-700 border border-amber-100'
                    }`}>
                      <span className={`mr-1.5 h-1 w-1 rounded-full ${inv.payment_state === 'paid' ? 'bg-green-600' : 'bg-amber-600'}`} />
                      {inv.display_status}
                    </span>
                  </td>
                  <td className="px-6 py-8 text-right">
                    <span className="font-serif text-xl text-primary">
                      ${inv.amount_total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
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
