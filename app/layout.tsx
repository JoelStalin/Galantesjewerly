import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { getSettings, type SiteSettings } from '@/lib/db';
import { Navbar } from '@/components/Navbar';
import { OdooService } from '@/lib/odoo/services';

export const dynamic = 'force-dynamic';

const FALLBACK_SETTINGS: SiteSettings = {
  site_title: "Galante's Jewelry by the Sea",
  site_description: 'Luxury jewelry boutique in Islamorada',
  favicon_url: '/favicon.ico',
  logo_url: '/logo.png',
  hero_image_url: '/hero-bg.jpg',
  instagram_url: 'https://instagram.com/galantesjewelrybythesea',
  facebook_url: 'https://facebook.com/people/Galantes-Jewelry-by-The-Sea/61574429843836',
  whatsapp_number: '16464965879',
  navigation_links: [
    { label: 'Home', href: '/' },
    { label: 'Shop', href: '/shop' },
    { label: 'Appointments', href: '/appointments' },
    { label: 'Contact', href: '/#contact' },
  ]
};

async function loadSiteSettings(): Promise<SiteSettings> {
  try {
    const localSettings = await getSettings();
    const odooSettings = await OdooService.getCompanySettings();
    
    // Merge order: Fallback < Local CMS < Odoo (Odoo has final say)
    return { 
      ...FALLBACK_SETTINGS, 
      ...(localSettings ?? {}),
      ...(odooSettings ?? {})
    };
  } catch {
    return FALLBACK_SETTINGS;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await loadSiteSettings();

  return {
    title: settings.site_title,
    description: settings.site_description,
    icons: { icon: settings.favicon_url || FALLBACK_SETTINGS.favicon_url },
    openGraph: {
      title: settings.site_title,
      description: settings.site_description,
      url: 'https://galantesjewelry.com',
      siteName: "Galante's Jewelry",
      locale: 'en_US',
      type: 'website',
    },
  };
}

import { CartProvider } from '@/context/shop/CartContext';
import { cookies } from 'next/headers';
import { verifyGoogleUserSession, GOOGLE_USER_COOKIE } from '@/lib/google-login';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const finalSettings = await loadSiteSettings();
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(GOOGLE_USER_COOKIE)?.value;
  const user = sessionToken ? await verifyGoogleUserSession(sessionToken) : null;

  return (
    <html lang="en">
      <head>
        <link rel="icon" href={finalSettings.favicon_url} sizes="any" />
      </head>
      <body className="bg-background text-foreground flex min-h-screen flex-col">
        <CartProvider>
          <Navbar settings={finalSettings} user={user} />
          <main className="flex-grow">{children}</main>
        </CartProvider>
        <Footer settings={finalSettings} />
        {/* Floating social buttons — stacked bottom-right */}
        {finalSettings.facebook_url && (
          <a
            href={finalSettings.facebook_url}
            target="_blank"
            rel="noopener noreferrer"
            className="fixed bottom-[9.5rem] right-6 z-50 flex items-center justify-center rounded-full bg-[#1877F2] p-4 text-white shadow-lg transition-transform hover:scale-110"
            title="Follow us on Facebook"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.513c-1.491 0-1.956.93-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
            </svg>
          </a>
        )}
        {finalSettings.instagram_url && (
          <a
            href={finalSettings.instagram_url}
            target="_blank"
            rel="noopener noreferrer"
            className="fixed bottom-[5.5rem] right-6 z-50 flex items-center justify-center rounded-full p-4 text-white shadow-lg transition-transform hover:scale-110"
            style={{ background: 'radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%)' }}
            title="Follow us on Instagram"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
            </svg>
          </a>
        )}
        {finalSettings.whatsapp_number && (
          <a
            href={`https://wa.me/${finalSettings.whatsapp_number}`}
            target="_blank"
            rel="noopener noreferrer"
            className="fixed bottom-6 right-6 z-50 flex items-center justify-center rounded-full bg-[#25D366] p-4 text-white shadow-lg transition-transform hover:scale-110"
            title="Chat with us on WhatsApp"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.445 0 .081 5.363.079 11.969c0 2.112.552 4.173 1.6 6.012L0 24l6.17-1.618a11.747 11.747 0 005.876 1.583h.004c6.602 0 11.967-5.367 11.97-11.97a11.815 11.815 0 00-3.351-8.441" />
            </svg>
          </a>
        )}
      </body>
    </html>
  );
}

function Footer({ settings }: { settings: SiteSettings }) {
  return (
    <footer className="mt-20 w-full bg-primary px-6 py-12 text-white md:px-12">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-3">
        <div>
          <h3 className="mb-4 font-serif text-2xl text-accent">Galante&apos;s Jewelry by the Sea</h3>
          <p className="text-sm leading-relaxed text-white/80">
            Barefoot luxury in Islamorada, with a concierge experience built around heirlooms,
            bridal moments, and coastal craftsmanship.
          </p>
          <div className="mt-6 flex gap-4">
            {settings.instagram_url && (
              <a
                href={settings.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white transition-colors hover:text-accent"
                title="Instagram"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                </svg>
              </a>
            )}
            {settings.facebook_url && (
              <a
                href={settings.facebook_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white transition-colors hover:text-accent"
                title="Facebook"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                </svg>
              </a>
            )}
            {settings.whatsapp_number && (
              <a
                href={`https://wa.me/${settings.whatsapp_number}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white transition-colors hover:text-accent"
                title="WhatsApp"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </a>
            )}
          </div>
        </div>
        <div>
          <h4 className="mb-4 font-serif text-lg text-accent">Services</h4>
          <ul className="space-y-2 text-sm text-white/80">
            <li><Link href="/collections" className="transition-colors hover:text-accent">Fine Collections</Link></li>
            <li><Link href="/bridal" className="transition-colors hover:text-accent">Destination Bridal</Link></li>
            <li><Link href="/repairs" className="transition-colors hover:text-accent">Jewelry and Watch Repair</Link></li>
            <li><Link href="/contact" className="transition-colors hover:text-accent">Private Consultations</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-4 font-serif text-lg text-accent">Contact Details</h4>
          <p className="text-sm leading-relaxed text-white/80">
            {settings.contact_address || "Located in the heart of Islamorada."}
            <br />
            {settings.contact_phone && (
              <span className="mt-2 block">
                Phone: {settings.contact_phone}
              </span>
            )}
            {settings.whatsapp_number && (
              <span className="mt-1 block">
                WhatsApp:{' '}
                <a href={`https://wa.me/${settings.whatsapp_number}`} className="underline">
                  +{settings.whatsapp_number}
                </a>
              </span>
            )}
          </p>
        </div>
      </div>
      <div className="mx-auto mt-12 max-w-6xl border-t border-white/20 pt-6 text-center text-xs text-white/60">
        <div className="mb-3 flex flex-wrap justify-center gap-4">
          <Link href="/privacy-policy" className="transition-colors hover:text-accent">Privacy Policy</Link>
          <Link href="/terms-of-service" className="transition-colors hover:text-accent">Terms of Service</Link>
        </div>
        &copy; {new Date().getFullYear()} Galante&apos;s Jewelry. All rights reserved.
      </div>
    </footer>
  );
}
