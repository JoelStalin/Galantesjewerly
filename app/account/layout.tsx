import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { verifyGoogleUserSession, GOOGLE_USER_COOKIE } from '@/lib/google-login';

interface AccountLayoutProps {
  children: React.ReactNode;
}

export default async function AccountLayout({ children }: AccountLayoutProps) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(GOOGLE_USER_COOKIE)?.value;

  if (!sessionToken) {
    redirect('/?auth=required');
  }

  const user = await verifyGoogleUserSession(sessionToken);

  if (!user) {
    redirect('/?auth=invalid');
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-12 md:px-12">
      <div className="flex flex-col gap-12 md:flex-row">
        {/* Sidebar Nav */}
        <aside className="w-full md:w-64">
          <div className="sticky top-32 space-y-8">
            <div>
              <h2 className="font-serif text-2xl text-primary">My Account</h2>
              <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
            </div>
            
            <nav className="flex flex-col gap-2 font-semibold uppercase tracking-widest text-xs">
              <Link 
                href="/account/orders" 
                className="border-b border-transparent py-2 transition-colors hover:border-accent hover:text-accent"
              >
                Orders
              </Link>
              <Link 
                href="/account/invoices" 
                className="border-b border-transparent py-2 transition-colors hover:border-accent hover:text-accent"
              >
                Invoices
              </Link>
              <Link 
                href="/auth/logout" 
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
