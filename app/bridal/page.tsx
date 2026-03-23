export const metadata = { title: "Bridal | Destination Weddings | Galante's Jewelry" };

export default function BridalPage() {
  return (
    <div className="max-w-5xl mx-auto py-24 px-6 text-center">
      <h1 className="text-5xl mb-6">Bridal & Destination</h1>
      <p className="text-lg opacity-80 mb-16 max-w-2xl mx-auto">
        Your love story, anchored in Islamorada. We craft bespoke engagement rings and wedding bands that celebrate your union.
      </p>
      
      <div className="flex flex-col md:flex-row gap-12 text-left items-center">
        <div className="w-full md:w-1/2 h-[500px] bg-stone-100 relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1605100804763-247f66150ce8?q=80&w=1470&auto=format&fit=crop')] bg-cover bg-center"></div>
        </div>
        <div className="w-full md:w-1/2">
          <h2 className="text-3xl mb-6">The Custom Experience</h2>
          <p className="opacity-80 leading-relaxed mb-6">
            Finding the perfect ring should be as memorable as the proposal itself. We offer private styling and custom design services to ensure your ring is entirely unique. 
          </p>
          <p className="opacity-80 leading-relaxed mb-8">
            Planning a destination wedding in the Florida Keys? Let us act as your jewelry concierge, preparing your rings for the big day.
          </p>
          <a href="/contact?intent=bridal" className="bg-primary text-white px-8 py-4 text-xs uppercase tracking-widest font-semibold hover:bg-primary-dark transition-colors inline-block">
            Book a Bridal Consultation
          </a>
        </div>
      </div>
    </div>
  );
}
