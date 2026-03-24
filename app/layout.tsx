import type { Metadata } from 'next';
import { Cormorant_Garamond, Manrope } from 'next/font/google';
import './globals.css';
import { getSettings } from '@/lib/db';

export const dynamic = "force-dynamic";

const manrope = Manrope({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const cormorant = Cormorant_Garamond({ subsets: ['latin'], variable: '--font-serif', weight: ['400', '500', '600'], display: 'swap' });

// Fallbacks estáticos para evitar errores durante compilación si la DB está bloqueada o vacía
const FALLBACK_SETTINGS = {
  site_title: "Galante's Jewelry by the Sea",
  site_description: "Luxury jewelry boutique in Islamorada",
  favicon_url: "/favicon.ico",
  logo_url: "/assets/branding/logo.png",
  instagram_url: "",
  facebook_url: "",
  whatsapp_number: ""
};

export async function generateMetadata(): Promise<Metadata> {
  try {
    const settings = await getSettings();
    return {
      title: settings.site_title || FALLBACK_SETTINGS.site_title,
      description: settings.site_description || FALLBACK_SETTINGS.site_description,
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
  } catch (e) {
    return { title: FALLBACK_SETTINGS.site_title, description: FALLBACK_SETTINGS.site_description };
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let settings;
  try {
    settings = await getSettings();
  } catch (e) {
    settings = FALLBACK_SETTINGS;
  }

  const finalSettings = { ...FALLBACK_SETTINGS, ...settings };

  return (
    <html lang="en">
      <head>
        <link rel="icon" href={finalSettings.favicon_url} sizes="any" />
      </head>
      <body className={`${manrope.variable} ${cormorant.variable} bg-background text-foreground flex min-h-screen flex-col`}>
        <Navbar logoUrl={finalSettings.logo_url} />
        <main className="flex-grow">{children}</main>
        <Footer settings={finalSettings} />
        {finalSettings.whatsapp_number && (
          <a
            href={`https://wa.me/${finalSettings.whatsapp_number}`}
            target="_blank"
            rel="noopener noreferrer"
            className="fixed bottom-6 right-6 z-50 bg-[#25D366] text-white p-4 rounded-full shadow-lg hover:scale-110 transition-transform flex items-center justify-center"
            title="Chat with us on WhatsApp"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.445 0 .081 5.363.079 11.969c0 2.112.552 4.173 1.6 6.012L0 24l6.17-1.618a11.747 11.747 0 005.876 1.583h.004c6.602 0 11.967-5.367 11.97-11.97a11.815 11.815 0 00-3.351-8.441"/></svg>
          </a>
        )}
      </body>
    </html>
  );
}

function Navbar({ logoUrl }: { logoUrl: string }) {
  return (
    <nav className="w-full border-b border-primary/10 bg-background/95 px-6 py-4 backdrop-blur md:px-12 sticky top-0 z-40">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <a href="/" className="flex items-center gap-3 text-primary">
          <span className="sr-only">Galante's Jewelry</span>
          <img src={logoUrl} alt="Logo" className="h-10 w-auto object-contain sm:h-12" />
          <span className="hidden font-serif text-lg tracking-[0.2em] uppercase md:inline">Galante's Jewelry</span>
        </a>
        <div className="hidden items-center gap-8 text-[11px] font-semibold uppercase tracking-[0.24em] md:flex">
          <a href="/about" className="hover:text-accent transition-colors">Heritage</a>
          <a href="/collections" className="hover:text-accent transition-colors">Collections</a>
          <a href="/bridal" className="hover:text-accent transition-colors">Bridal</a>
          <a href="/repairs" className="hover:text-accent transition-colors">Repairs</a>
          <a href="/contact" className="hover:text-accent transition-colors">Contact</a>
        </div>
      </div>
    </nav>
  );
}

function Footer({ settings }: { settings: any }) {
  return (
    <footer className="mt-20 w-full bg-primary px-6 py-12 text-white md:px-12">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-3">
        <div>
          <h3 className="mb-4 font-serif text-2xl text-accent">Galante's Jewelry by the Sea</h3>
          <p className="text-sm leading-relaxed text-white/80">
            Barefoot luxury in Islamorada, with a concierge experience built around heirlooms,
            bridal moments, and coastal craftsmanship.
          </p>
          <div className="mt-6 flex gap-4">
            {settings.instagram_url && (
              <a href={settings.instagram_url} target="_blank" rel="noopener noreferrer" className="text-white hover:text-accent transition-colors" title="Instagram">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
              </a>
            )}
            {settings.facebook_url && (
              <a href={settings.facebook_url} target="_blank" rel="noopener noreferrer" className="text-white hover:text-accent transition-colors" title="Facebook">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
              </a>
            )}
            {settings.whatsapp_number && (
              <a href={`https://wa.me/${settings.whatsapp_number}`} target="_blank" rel="noopener noreferrer" className="text-white hover:text-accent transition-colors" title="WhatsApp">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              </a>
            )}
          </div>
        </div>
        <div>
          <h4 className="mb-4 font-serif text-lg text-accent">Services</h4>
          <ul className="space-y-2 text-sm text-white/80">
            <li><a href="/collections" className="hover:text-accent transition-colors">Fine Collections</a></li>
            <li><a href="/bridal" className="hover:text-accent transition-colors">Destination Bridal</a></li>
            <li><a href="/repairs" className="hover:text-accent transition-colors">Jewelry & Watch Repair</a></li>
            <li><a href="/contact" className="hover:text-accent transition-colors">Private Consultations</a></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-4 font-serif text-lg text-accent">Contact Details</h4>
          <p className="text-sm leading-relaxed text-white/80">
            Located in the heart of Islamorada.<br />
            {settings.whatsapp_number && (
              <span className="mt-2 block">WhatsApp: <a href={`https://wa.me/${settings.whatsapp_number}`} className="underline">+{settings.whatsapp_number}</a></span>
            )}
          </p>
        </div>
      </div>
      <div className="mx-auto mt-12 max-w-6xl border-t border-white/20 pt-6 text-center text-xs text-white/60">
        &copy; {new Date().getFullYear()} Galante's Jewelry. All rights reserved.
      </div>
    </footer>
  );
}
