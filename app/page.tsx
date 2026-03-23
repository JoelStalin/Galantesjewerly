import Image from "next/image";

export default function Home() {
  return (
    <div className="flex flex-col items-center w-full">
      {/* Hero Section */}
      <section className="relative w-full h-[80vh] min-h-[600px] flex flex-col justify-center items-center text-center px-4 bg-primary text-white overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1516912481808-3406841bd33c?q=80&w=2844&auto=format&fit=crop')] bg-cover bg-center"></div>
        <div className="z-10 max-w-4xl mx-auto flex flex-col items-center">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif text-accent mb-6 leading-tight">
            Galante's Jewelry by the Sea
          </h1>
          <p className="text-lg md:text-2xl font-light tracking-wide mb-10 text-white/90">
            The Coastal Concierge
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a href="/contact" className="bg-accent text-primary-dark px-8 py-4 text-sm uppercase tracking-widest font-semibold hover:bg-accent-light transition-colors">
              Book a Private Appointment
            </a>
            <a href="/collections" className="border border-accent text-accent px-8 py-4 text-sm uppercase tracking-widest font-semibold hover:bg-accent hover:text-primary-dark transition-colors">
              Explore the Collections
            </a>
          </div>
        </div>
      </section>

      {/* Philosophy Section */}
      <section className="py-24 px-6 md:px-12 max-w-5xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl mb-6">Barefoot Luxury from Islamorada</h2>
        <p className="text-lg opacity-80 leading-relaxed max-w-3xl mx-auto">
          We curate and craft fine nautical jewelry designed to celebrate the spirit of the Florida Keys. 
          Whether you are marking an anniversary, planning a destination wedding, or restoring an heirloom timepiece, 
          our concierge service ensures every detail is attended to with master craftsmanship.
        </p>
      </section>

      {/* Featured Services Grid */}
      <section className="w-full bg-white py-24 px-6 md:px-12">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
          
          <div className="flex flex-col items-center text-center">
            <div className="w-full h-80 bg-stone-100 mb-6 relative overflow-hidden group">
               <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1599643478514-4a52023960c1?q=80&w=1471&auto=format&fit=crop')] bg-cover bg-center transition-transform duration-700 group-hover:scale-105"></div>
            </div>
            <h3 className="text-2xl mb-3">Destination Weddings</h3>
            <p className="opacity-70 text-sm mb-4">Bespoke engagement rings and wedding bands designed to capture your moment by the sea.</p>
            <a href="/bridal" className="text-primary font-semibold uppercase tracking-wider text-xs border-b border-primary pb-1">Discover Bridal</a>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="w-full h-80 bg-stone-100 mb-6 relative overflow-hidden group">
               <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?q=80&w=1587&auto=format&fit=crop')] bg-cover bg-center transition-transform duration-700 group-hover:scale-105"></div>
            </div>
            <h3 className="text-2xl mb-3">Nautical Gold & Silver</h3>
            <p className="opacity-70 text-sm mb-4">Signature pieces honoring our coastal heritage, from mariner links to compass pendants.</p>
            <a href="/collections" className="text-primary font-semibold uppercase tracking-wider text-xs border-b border-primary pb-1">View Collections</a>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="w-full h-80 bg-stone-100 mb-6 relative overflow-hidden group">
               <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1584811644165-4f367e1a3962?q=80&w=1626&auto=format&fit=crop')] bg-cover bg-center transition-transform duration-700 group-hover:scale-105"></div>
            </div>
            <h3 className="text-2xl mb-3">Master Repair</h3>
            <p className="opacity-70 text-sm mb-4">Entrust your cherished watches and heirlooms to our master jewelers for restoration.</p>
            <a href="/repairs" className="text-primary font-semibold uppercase tracking-wider text-xs border-b border-primary pb-1">Service Details</a>
          </div>

        </div>
      </section>

      {/* Review Proof */}
      <section className="w-full py-24 bg-stone-50 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl mb-12">Words from Our Patrons</h2>
          <blockquote className="text-xl md:text-2xl font-serif text-primary italic leading-relaxed mb-6">
            "Galante's created the most breathtaking engagement ring for my fiancé. Their attention to detail and personal concierge service made our Islamorada trip truly unforgettable."
          </blockquote>
          <cite className="block text-sm uppercase tracking-widest font-semibold text-accent not-italic">— Sarah & James, Florida</cite>
        </div>
      </section>

      {/* Final CTA */}
      <section className="w-full py-32 px-6 flex flex-col items-center justify-center bg-primary text-white text-center">
        <h2 className="text-4xl md:text-5xl text-accent mb-6">Begin Your Story</h2>
        <p className="max-w-2xl text-lg opacity-80 mb-10">
          Whether you are visiting the Florida Keys or are a local resident, we invite you to experience jewelry curation as it should be.
        </p>
        <a href="/contact" className="bg-accent text-primary-dark px-10 py-5 text-sm uppercase tracking-widest font-bold hover:bg-accent-light transition-colors">
          Schedule Your Consultation
        </a>
      </section>

    </div>
  );
}
