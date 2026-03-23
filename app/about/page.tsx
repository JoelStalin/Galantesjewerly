export const metadata = { title: "Our Heritage | Galante's Jewelry" };

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto py-24 px-6 text-center">
      <h1 className="text-5xl mb-8">Our Heritage</h1>
      <p className="text-lg opacity-80 leading-relaxed mb-8">
        Located in the heart of Islamorada, Galante's Jewelry by the Sea brings decades of master craftsmanship to the Florida Keys. We are not just jewelers; we are concierges of your most cherished memories.
      </p>
      <div className="my-16 w-full h-96 bg-stone-200 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1617038220319-276d3cfab638?q=80&w=1470&auto=format&fit=crop')] bg-cover bg-center"></div>
      </div>
      <p className="text-lg opacity-80 leading-relaxed">
        Our "barefoot luxury" philosophy means we believe true exclusivity is found in warm, personalized service without pretension. We specialize in nautical-inspired pieces, exquisite bridal selections, and restoring heirlooms passed down through generations.
      </p>
    </div>
  );
}
