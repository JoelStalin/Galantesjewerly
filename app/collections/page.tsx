export const metadata = { title: "Collections | Galante's Jewelry" };

export default function CollectionsPage() {
  return (
    <div className="max-w-6xl mx-auto py-24 px-6 text-center">
      <h1 className="text-5xl mb-6">Fine Collections</h1>
      <p className="text-lg opacity-80 max-w-2xl mx-auto mb-16">
        Curated selections reflecting the beauty of the sea and the elegance of classic design.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
        <div className="group text-left cursor-pointer">
          <div className="w-full h-96 bg-stone-100 mb-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1599643477877-530eb83abc8e?q=80&w=1471&auto=format&fit=crop')] bg-cover bg-center transition-transform duration-700 group-hover:scale-105"></div>
          </div>
          <h2 className="text-2xl mb-2">Ocean & Nautical</h2>
          <p className="opacity-70 text-sm mb-4">Capturing our Florida Keys heritage in 14k gold and sterling silver.</p>
          <a href="/contact" className="text-xs uppercase tracking-widest font-bold text-primary underline">Inquire About Pieces</a>
        </div>
        
        <div className="group text-left cursor-pointer">
          <div className="w-full h-96 bg-stone-100 mb-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1611591437281-460bfbe1220a?q=80&w=1470&auto=format&fit=crop')] bg-cover bg-center transition-transform duration-700 group-hover:scale-105"></div>
          </div>
          <h2 className="text-2xl mb-2">Signature Diamonds</h2>
          <p className="opacity-70 text-sm mb-4">Ethically sourced, masterfully set diamonds for every occasion.</p>
          <a href="/contact" className="text-xs uppercase tracking-widest font-bold text-primary underline">Inquire About Pieces</a>
        </div>
      </div>
    </div>
  );
}
