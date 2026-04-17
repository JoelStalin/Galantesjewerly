'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useCart } from '@/context/shop/CartContext';

interface NavbarProps {
  logoUrl: string;
}

const NAV_LINKS = [
  { href: '/about', label: 'Heritage' },
  { href: '/collections', label: 'Collections' },
  { href: '/bridal', label: 'Bridal' },
  { href: '/repairs', label: 'Repairs' },
  { href: '/contact', label: 'Contact' },
];

export function Navbar({ logoUrl }: NavbarProps) {
  const [open, setOpen] = useState(false);
  const { totalCount } = useCart();

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-primary/10 bg-background/95 px-6 py-4 backdrop-blur md:px-12">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 text-primary" onClick={() => setOpen(false)}>
          <span className="sr-only">Galante&apos;s Jewelry</span>
          <Image
            src={logoUrl}
            alt="Logo"
            width={160}
            height={48}
            className="h-10 w-auto object-contain sm:h-12"
            unoptimized={logoUrl.startsWith('/api/image?')}
          />
          <span className="hidden font-serif text-lg uppercase tracking-[0.2em] md:inline">
            Galante&apos;s Jewelry
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden items-center gap-8 text-[11px] font-semibold uppercase tracking-[0.24em] md:flex">
          {NAV_LINKS.map(({ href, label }) => (
            <Link key={href} href={href} className="transition-colors hover:text-accent">
              {label}
            </Link>
          ))}
        </div>

        {/* Right side: Cart + Shop CTA + hamburger */}
        <div className="flex items-center gap-3 md:gap-6">
          {/* Cart Icon — Only visible if items > 0 */}
          {totalCount > 0 && (
            <Link
              href="/cart"
              className="relative p-2 text-primary hover:text-accent transition-colors"
              aria-label={`View shopping cart with ${totalCount} items`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.112 16.826a2.125 2.125 0 0 1-2.122 2.265H5.257a2.125 2.125 0 0 1-2.122-2.265l1.112-16.826a2.125 2.125 0 0 1 2.122-1.993h12.268a2.125 2.125 0 0 1 2.122 1.993Zm-9.286-4.207V10.5A.75.75 0 0 1 9 11.25H6.75a.75.75 0 0 1-.75-.75V6.75a2.25 2.25 0 0 1 4.5 0Zm6.75 0V10.5a.75.75 0 0 1-.75.75H12.75a.75.75 0 0 1-.75-.75V6.75a2.25 2.25 0 0 1 4.5 0Z" />
              </svg>
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-primary-dark">
                {totalCount}
              </span>
            </Link>
          )}

          <Link
            href="/shop"
            className="inline-flex items-center justify-center rounded-full border border-accent bg-accent px-5 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-primary-dark transition hover:bg-accent-light focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background"
            aria-label="Visit our shop"
          >
            Shop
          </Link>

          {/* Hamburger — mobile only */}
          <button
            className="flex flex-col items-center justify-center gap-[5px] p-2 md:hidden"
            onClick={() => setOpen(!open)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            <span className={`block h-[2px] w-6 bg-primary transition-transform duration-200 ${open ? 'translate-y-[7px] rotate-45' : ''}`} />
            <span className={`block h-[2px] w-6 bg-primary transition-opacity duration-200 ${open ? 'opacity-0' : ''}`} />
            <span className={`block h-[2px] w-6 bg-primary transition-transform duration-200 ${open ? '-translate-y-[7px] -rotate-45' : ''}`} />
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="mt-4 flex flex-col gap-4 border-t border-primary/10 pt-4 md:hidden">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-[13px] font-semibold uppercase tracking-[0.24em] text-primary transition-colors hover:text-accent"
              onClick={() => setOpen(false)}
            >
              {label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
