'use client';

import { usePathname } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { SiteSettings } from '@/lib/db';
import type { AuthenticatedCustomer } from '@/lib/customer-auth';

interface ConditionalNavbarProps {
  settings: SiteSettings;
  user?: AuthenticatedCustomer | null;
}

export function ConditionalNavbar({ settings, user }: ConditionalNavbarProps) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin');
  const isCustomerAuth = pathname?.startsWith('/auth/');
  const isHome = pathname === '/';

  if (isAdmin) return null;

  return <Navbar settings={settings} user={user} forceSolid={Boolean(isCustomerAuth)} isFixed={!isHome} />;
}
