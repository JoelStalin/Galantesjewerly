export const metadata = { title: "Repairs | Watch Service | Galante's Jewelry" };

export default function RepairsPage() {
  return (
    <div className="max-w-4xl mx-auto py-24 px-6 text-center">
      <h1 className="text-5xl mb-8">Master Repair Service</h1>
      <p className="text-lg opacity-80 leading-relaxed mb-12">
        A cherished timepiece or a family heirloom deserves expert hands. Our master jewelers provide unparalleled restoration, servicing, and repair.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
        <div className="p-8 border border-stone-200">
          <h3 className="text-xl font-serif mb-4 text-primary">Watch Servicing</h3>
          <ul className="text-sm opacity-80 space-y-2 list-disc pl-4">
            <li>Battery replacement & pressure testing</li>
            <li>Mechanical overhaul & calibration</li>
            <li>Crystal replacement</li>
            <li>Strap and bracelet sizing</li>
          </ul>
        </div>
        <div className="p-8 border border-stone-200">
          <h3 className="text-xl font-serif mb-4 text-primary">Jewelry Restoration</h3>
          <ul className="text-sm opacity-80 space-y-2 list-disc pl-4">
            <li>Ring sizing & prong re-tipping</li>
            <li>Pearl and bead restringing</li>
            <li>Stone replacement & mounting</li>
            <li>Polishing & rhodium plating</li>
          </ul>
        </div>
      </div>
      
      <div className="mt-16">
        <a href="/contact?intent=repair" className="bg-primary text-white px-8 py-4 text-xs uppercase tracking-widest font-semibold hover:bg-primary-dark transition-colors">
          Request a Service Assessment
        </a>
      </div>
    </div>
  );
}
