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

interface NavbarProps {
  settings: SiteSettings;
  user?: AuthenticatedCustomer | null;
}

export function Navbar({ settings, user }: NavbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { totalCount } = useCart();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const logoUrl = settings.logo_url;
  const navLinks = settings.navigation_links || [];

  return (
    <nav 
      className={`fixed w-full z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm py-3' : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          {/* Logo & Title */}
          <div className="flex items-center space-x-4 flex-1">
            <Link href="/" className="flex items-center space-x-4 group" onClick={() => setIsOpen(false)}>
              <Image 
                src={logoUrl || "/assets/branding/logo.png"} 
                alt="Galante's" 
                width={200}
                height={200}
                className="h-32 w-32 md:h-48 md:w-48 object-contain transition-transform group-hover:scale-105"
                unoptimized={!!(logoUrl && (logoUrl.startsWith('/api/image?') || logoUrl.startsWith('http')))}
              />
              <div className="flex flex-col">
                <span className="text-[10px] md:text-xs font-serif tracking-[0.3em] uppercase text-gray-900 leading-relaxed max-w-[150px] md:max-w-none">
                  {settings.site_title || "Galante's Jewelry"}
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center justify-center space-x-6 lg:space-x-8 flex-[2]">
            {(navLinks.length > 0 ? navLinks : FALLBACK_NAV).map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-[10px] lg:text-[11px] font-semibold tracking-[0.24em] uppercase text-gray-800 hover:text-amber-700 transition-colors whitespace-nowrap"
                style={{ textShadow: scrolled ? 'none' : '0 0 12px rgba(255,255,255,0.8), 0 0 4px rgba(255,255,255,0.5)' }}
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
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
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
