import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' });

export const metadata: Metadata = {
  title: "Galante's Jewelry by the Sea | The Coastal Concierge",
  description: "Luxury boutique jewelry in Islamorada. We craft bespoke nautical jewelry, destination wedding pieces, and master-level watch repairs.",
  openGraph: {
    title: "Galante's Jewelry by the Sea",
    description: "The Coastal Concierge of Islamorada. Fine jewelry, engagement rings, and expert repair.",
    url: 'https://galantesjewelry.com',
    siteName: "Galante's Jewelry",
    images: [
      {
        url: 'https://galantesjewelry.com/assets/branding/logo.png',
        width: 800,
        height: 600,
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "JewelryStore",
            "name": "Galante's Jewelry by the Sea",
            "url": "https://galantesjewelry.com",
            "image": "https://galantesjewelry.com/assets/branding/logo.png",
            "description": "Luxury boutique jewelry in Islamorada. We craft bespoke nautical jewelry, destination wedding pieces, and master-level watch repairs.",
            "address": {
              "@type": "PostalAddress",
              "streetAddress": "123 Overseas Highway",
              "addressLocality": "Islamorada",
              "addressRegion": "FL",
              "postalCode": "33036",
              "addressCountry": "US"
            },
            "telephone": "+13055550199",
            "priceRange": "$$$$"
          })
        }} />
      </head>
      <body className={`${inter.variable} ${playfair.variable} bg-background text-foreground flex flex-col min-h-screen`}>
        <Navbar />
        <main className="flex-grow">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}

function Navbar() {
  return (
    <nav className="w-full py-4 px-6 md:px-12 flex justify-between items-center border-b border-primary/10">
      <div className="flex items-center space-x-2">
        <a href="/" className="font-serif text-xl sm:text-2xl text-primary tracking-wide">
          <span className="sr-only">Galante's Jewelry</span>
          <img src="/assets/branding/logo.png" alt="Galante's Jewelry Logo" className="h-10 sm:h-12 w-auto object-contain" />
        </a>
      </div>
      <div className="hidden md:flex space-x-8 text-sm uppercase tracking-widest font-medium">
        <a href="/about" className="hover:text-accent transition-colors">Our Heritage</a>
        <a href="/collections" className="hover:text-accent transition-colors">Collections</a>
        <a href="/bridal" className="hover:text-accent transition-colors">Bridal</a>
        <a href="/repairs" className="hover:text-accent transition-colors">Repairs</a>
        <a href="/contact" className="hover:text-accent transition-colors">Contact</a>
      </div>
      <div className="md:hidden">
        {/* Mobile menu button placeholder */}
        <button aria-label="Open menu" className="p-2">
          <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="w-full bg-primary text-white py-12 px-6 md:px-12 mt-20">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <h3 className="font-serif text-2xl mb-4 text-accent">Galante's Jewelry by the Sea</h3>
          <p className="text-sm opacity-80 leading-relaxed">
            The Coastal Concierge of Islamorada.<br />
            Crafting bespoke nautical elegance and<br />
            preserving heritage through master repair.
          </p>
        </div>
        <div>
          <h4 className="font-serif text-lg mb-4 text-accent">Discover</h4>
          <ul className="space-y-2 text-sm opacity-80">
            <li><a href="/collections" className="hover:text-accent transition-colors">Fine Collections</a></li>
            <li><a href="/bridal" className="hover:text-accent transition-colors">Destination Weddings</a></li>
            <li><a href="/repairs" className="hover:text-accent transition-colors">Watch & Jewelry Service</a></li>
            <li><a href="/journal" className="hover:text-accent transition-colors">The Journal</a></li>
          </ul>
        </div>
        <div>
          <h4 className="font-serif text-lg mb-4 text-accent">Visit Us</h4>
          <p className="text-sm opacity-80 leading-relaxed">
            Islamorada, Florida Keys<br />
            Private Consultations Recommended.<br />
            <a href="/contact" className="underline hover:text-accent mt-2 block w-fit">Book an Appointment</a>
          </p>
        </div>
      </div>
      <div className="max-w-6xl mx-auto mt-12 pt-6 border-t border-white/20 text-xs text-center opacity-60">
        &copy; {new Date().getFullYear()} Galante's Jewelry. All rights reserved.
      </div>
    </footer>
  );
}
