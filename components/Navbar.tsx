'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ShoppingBag, Menu, X, User } from 'lucide-react';
import { SiteSettings } from '@/lib/db';
import { GoogleUserSessionPayload } from '@/lib/google-login';
import { useCart } from '@/context/shop/CartContext';

interface NavbarProps {
  settings: SiteSettings;
  user?: GoogleUserSessionPayload | null;
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
            <Link href="/" className="flex items-center space-x-3 group" onClick={() => setIsOpen(false)}>
              <Image 
                src={logoUrl || "/assets/branding/logo-anchor.png"} 
                alt="Galante's" 
                width={40}
                height={40}
                className="h-10 w-10 object-contain transition-transform group-hover:scale-105"
                unoptimized={logoUrl.startsWith('/api/image?')}
              />
              <span className={`text-xl font-serif tracking-widest uppercase transition-colors hidden sm:inline ${
                scrolled ? 'text-gray-900' : 'text-gray-900'
              }`}>
                {settings.site_title || "Galante's"}
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center justify-center space-x-10 flex-[2]">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-[11px] font-semibold tracking-[0.24em] uppercase text-gray-800 hover:text-amber-700 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Icons & Actions */}
          <div className="flex items-center justify-end space-x-6 flex-1">
            <Link
              href={user ? "/account" : "/api/auth/google/start"}
              className="hidden sm:flex items-center space-x-2 text-gray-700 hover:text-amber-700 transition-colors"
              title={user ? "Account" : "Customer Login"}
            >
              <User size={20} />
              <span className="text-[10px] uppercase tracking-widest font-bold">
                {user ? 'Account' : 'Login'}
              </span>
            </Link>
            
            <Link href="/cart" className="relative text-gray-900 hover:text-amber-700 transition-colors">
              <ShoppingBag size={22} strokeWidth={1.5} />
              {totalCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-600 text-[9px] font-bold text-white">
                  {totalCount}
                </span>
              )}
            </Link>
            
            <Link 
              href="/shop" 
              className="hidden lg:block border border-gray-900 bg-gray-900 text-white px-6 py-2 rounded-full text-[10px] font-bold tracking-widest uppercase transition-all hover:bg-transparent hover:text-gray-900 active:scale-95"
            >
              Shop
            </Link>

            <button 
              className="md:hidden text-gray-900 p-2"
              onClick={() => setIsOpen(!isOpen)}
              aria-label="Toggle menu"
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
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
                href={user ? "/account" : "/api/auth/google/start"}
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
