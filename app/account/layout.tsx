import { cookies, headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuthenticatedCustomerFromCookies } from '@/lib/customer-auth';
import { buildCustomerLoginHref } from '@/lib/customer-navigation';

interface AccountLayoutProps {
  children: React.ReactNode;
}

export default async function AccountLayout({ children }: AccountLayoutProps) {
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const currentUrl = requestHeaders.get('x-current-url') || '';
  const user = await getAuthenticatedCustomerFromCookies(cookieStore);

  if (!user) {
    redirect(buildCustomerLoginHref(currentUrl));
  }

  return (
    <div className="mx-auto max-w-7xl px-6 pb-12 pt-48 md:px-12 md:pb-16 md:pt-56">
      <div className="flex flex-col gap-12 md:flex-row">
        {/* Sidebar Nav */}
        <aside className="w-full md:w-64 md:shrink-0">
          <div className="space-y-8 md:sticky md:top-56 md:max-h-[calc(100vh-14rem)] md:overflow-y-auto">
            <div>
              <h2 className="font-serif text-2xl text-primary">My Account</h2>
              <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
            </div>
            
            <nav className="flex flex-col gap-2 font-semibold uppercase tracking-widest text-xs">
              <Link
                href="/account/orders"
                prefetch={false}
                className="border-b border-transparent py-2 transition-colors hover:border-accent hover:text-accent"
              >
                Orders
              </Link>
              <Link
                href="/account/invoices"
                prefetch={false}
                className="border-b border-transparent py-2 transition-colors hover:border-accent hover:text-accent"
              >
                Invoices
              </Link>
              <Link
                href="/account/addresses"
                prefetch={false}
                className="border-b border-transparent py-2 transition-colors hover:border-accent hover:text-accent"
              >
                Addresses
              </Link>
              <Link
                href="/account/settings"
                prefetch={false}
                className="border-b border-transparent py-2 transition-colors hover:border-accent hover:text-accent"
              >
                Settings
              </Link>
              <Link
                href="/auth/logout"
                prefetch={false}
                className="mt-4 text-red-500 transition-colors hover:text-red-600"
              >
                Sign Out
              </Link>
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-grow">
          <div className="rounded-lg border border-primary/10 bg-white/50 p-8 backdrop-blur-sm">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
