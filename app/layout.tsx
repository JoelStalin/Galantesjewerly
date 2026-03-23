import type { Metadata } from 'next';
import { Cormorant_Garamond, Manrope } from 'next/font/google';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  variable: '--font-serif',
  weight: ['400', '500', '600'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: "Galante's Jewelry by the Sea | Coastal Fine Jewelry in Islamorada",
  description:
    'Luxury jewelry boutique in Islamorada focused on bridal pieces, nautical collections, repairs, and private consultations.',
  openGraph: {
    title: "Galante's Jewelry by the Sea",
    description:
      'Barefoot luxury, bridal jewelry, repairs, and concierge-level service in the Florida Keys.',
    url: 'https://galantesjewelry.com',
    siteName: "Galante's Jewelry",
    locale: 'en_US',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${cormorant.variable} bg-background text-foreground flex min-h-screen flex-col`}>
        <Navbar />
        <main className="flex-grow">{children}</main>
        <Footer />
      </body>
    </html>
  );
}

function Navbar() {
  return (
    <nav className="w-full border-b border-primary/10 bg-background/95 px-6 py-4 backdrop-blur md:px-12">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <a href="/" className="flex items-center gap-3 text-primary">
          <span className="sr-only">Galante's Jewelry</span>
          <img src="/assets/branding/logo.png" alt="Galante's Jewelry Logo" className="h-10 w-auto object-contain sm:h-12" />
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

function Footer() {
  return (
    <footer className="mt-20 w-full bg-primary px-6 py-12 text-white md:px-12">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-3">
        <div>
          <h3 className="mb-4 font-serif text-2xl text-accent">Galante's Jewelry by the Sea</h3>
          <p className="text-sm leading-relaxed text-white/80">
            Barefoot luxury in Islamorada, with a concierge experience built around heirlooms,
            bridal moments, and coastal craftsmanship.
          </p>
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
          <h4 className="mb-4 font-serif text-lg text-accent">Deployment Notes</h4>
          <p className="text-sm leading-relaxed text-white/80">
            This project is prepared for Docker, Nginx reverse proxying, and Cloudflare Tunnel.
            Configure real business contact data through environment variables or CMS content before launch.
          </p>
        </div>
      </div>
      <div className="mx-auto mt-12 max-w-6xl border-t border-white/20 pt-6 text-center text-xs text-white/60">
        &copy; {new Date().getFullYear()} Galante's Jewelry. All rights reserved.
      </div>
    </footer>
  );
}
