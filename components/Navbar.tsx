'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ShoppingBag, Menu, X, User } from 'lucide-react';
import { SiteSettings } from '@/lib/db';
import type { AuthenticatedCustomer } from '@/lib/customer-auth';
import { useCart } from '@/context/shop/CartContext';

const FALLBACK_NAV = [
  { label: 'Heritage', href: '/about' },
  { label: 'Collections', href: '/collections' },
  { label: 'Bridal', href: '/bridal' },
  { label: 'Repairs', href: '/repairs' },
  { label: 'Contact', href: '/contact' },
];

function normalizeHref(rawHref: string | undefined, fallbackHref: string): string {
  const href = (rawHref || '').trim();
  if (!href) return fallbackHref;
  if (href.startsWith('#')) return `/${href}`;
  if (/^(https?:\/\/|mailto:|tel:)/i.test(href)) return href;
  if (href.startsWith('/')) return href;
  return `/${href}`;
}

function resolveNavigationLinks(
  links: Array<{ label?: string; href?: string }> | undefined,
): Array<{ label: string; href: string }> {
  if (!Array.isArray(links) || links.length === 0) {
    return FALLBACK_NAV;
  }

  const normalized = links
    .map((link, index) => {
      const fallback = FALLBACK_NAV[index] ?? FALLBACK_NAV[FALLBACK_NAV.length - 1];
      const label = (link?.label || fallback.label).trim() || fallback.label;
      const href = normalizeHref(link?.href, fallback.href);
      return { label, href };
    })
    .filter((link) => Boolean(link.label) && Boolean(link.href));

  return normalized.length > 0 ? normalized : FALLBACK_NAV;
}

interface NavbarProps {
  settings: SiteSettings;
  user?: AuthenticatedCustomer | null;
  forceSolid?: boolean;
  isFixed?: boolean;
}

export function Navbar({ settings, user, forceSolid = false, isFixed = true }: NavbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { totalCount } = useCart();
  const useSolidNav = forceSolid || scrolled;
  const brandName = settings.brand_name?.trim() || settings.site_title?.trim() || "Galante's Jewelry";
  const brandTagline = settings.brand_tagline?.trim() || 'By The Sea';

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const logoUrl = settings.logo_url;
  const resolvedNavLinks = resolveNavigationLinks(settings.navigation_links as Array<{ label?: string; href?: string }> | undefined);

  return (
    <nav 
      className={`${isFixed ? 'fixed' : 'absolute'} top-0 left-0 w-full z-50 transition-all duration-300 ${
        useSolidNav ? 'bg-white/95 backdrop-blur-md shadow-sm py-3' : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          {/* Logo & Title */}
          <div className="flex items-center flex-1 min-w-0">
            <Link href="/" className="flex items-center gap-2 sm:gap-3 group min-w-0" onClick={() => setIsOpen(false)}>
              <Image 
                src={logoUrl || "/assets/branding/logo.png"} 
                alt="Galante's" 
                width={200}
                height={200}
                className="h-16 w-16 sm:h-18 sm:w-18 md:h-20 md:w-20 object-contain transition-transform group-hover:scale-105 shrink-0"
                unoptimized={!!(logoUrl && (logoUrl.startsWith('/api/image?') || logoUrl.startsWith('http')))}
              />
              <div className="min-w-0">
                <span data-testid="navbar-brand-name-mobile" className="block sm:hidden text-[10px] font-serif tracking-[0.22em] uppercase text-gray-900 leading-snug max-w-[110px]">
                  {brandName}
                </span>
                <div className="hidden sm:flex flex-col leading-none">
                  <span data-testid="navbar-brand-name" className="text-[11px] md:text-xs font-serif tracking-[0.24em] uppercase text-gray-900 whitespace-nowrap">
                    {brandName}
                  </span>
                  <span data-testid="navbar-brand-tagline" className="mt-1 text-[9px] md:text-[10px] tracking-[0.34em] uppercase text-zinc-500 whitespace-nowrap">
                    {brandTagline}
                  </span>
                </div>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center justify-center space-x-6 lg:space-x-8 flex-[2]">
            {resolvedNavLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                prefetch={false}
                className="text-[10px] lg:text-[11px] font-semibold tracking-[0.24em] uppercase text-gray-800 hover:text-amber-700 transition-colors whitespace-nowrap"
                style={{ textShadow: useSolidNav ? 'none' : '0 0 12px rgba(255,255,255,0.8), 0 0 4px rgba(255,255,255,0.5)' }}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Icons & Actions */}
          <div className="flex items-center justify-end space-x-4 lg:space-x-6 flex-1">
            <Link
              href={user ? "/account" : "/auth/login"}
              className="hidden sm:flex items-center space-x-2 text-gray-700 hover:text-amber-700 transition-colors"
              title={user ? "Account" : "Customer Login"}
            >
              <User size={18} className="lg:w-5 lg:h-5" />
              <span className="text-[9px] lg:text-[10px] uppercase tracking-widest font-bold">
                {user ? 'Account' : 'Login'}
              </span>
            </Link>
            
            <Link href="/cart" className="relative text-gray-900 hover:text-amber-700 transition-colors">
              <ShoppingBag size={20} className="lg:w-5.5 lg:h-5.5" strokeWidth={1.5} />
              {totalCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 lg:h-4 lg:w-4 items-center justify-center rounded-full bg-amber-600 text-[8px] lg:text-[9px] font-bold text-white shadow-sm">
                  {totalCount}
                </span>
              )}
            </Link>
            
            <Link 
              href="/shop" 
              className="hidden lg:block border border-gray-900 bg-gray-900 text-white px-5 py-2 rounded-full text-[9px] font-bold tracking-widest uppercase transition-all hover:bg-transparent hover:text-gray-900 active:scale-95 shadow-sm"
            >
              Shop
            </Link>

            <button 
              className="md:hidden text-gray-900 p-2 hover:bg-gray-100 rounded-full transition-colors"
              onClick={() => setIsOpen(!isOpen)}
              aria-label="Toggle menu"
            >
              {isOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-white shadow-xl animate-in slide-in-from-top duration-300">
          <div className="px-4 pt-2 pb-8 space-y-1">
            {resolvedNavLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                prefetch={false}
                className="block px-3 py-4 text-sm font-semibold text-gray-900 border-b border-gray-50 uppercase tracking-[0.2em]"
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-6 flex flex-col space-y-4">
              <Link
                href={user ? "/account" : "/auth/login"}
                className="flex items-center space-x-3 px-3 py-2 text-gray-700"
                onClick={() => setIsOpen(false)}
              >
                <User size={20} />
                <span className="text-sm font-semibold uppercase tracking-widest">
                  {user ? 'My Account' : 'Customer Login'}
                </span>
              </Link>
              <Link 
                href="/shop" 
                className="bg-gray-900 text-white text-center px-6 py-4 rounded-xl text-xs font-bold tracking-widest uppercase shadow-lg active:scale-95 transition-transform"
                onClick={() => setIsOpen(false)}
              >
                Shop Now
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
