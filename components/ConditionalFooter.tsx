'use client';

import { usePathname } from 'next/navigation';
import React from 'react';

export function ConditionalFooter({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin');

  if (isAdmin) return null;

  return <>{children}</>;
}
