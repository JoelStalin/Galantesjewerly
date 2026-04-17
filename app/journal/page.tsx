export const metadata = { title: "Journal | Galante's Jewelry" };

export default function JournalPage() {
  return (
    <div className="max-w-4xl mx-auto py-24 px-6 text-center">
      <h1 className="text-5xl mb-6">The Journal</h1>
      <p className="text-lg opacity-80 mb-16">Stories of heritage, the Florida Keys, and fine craftsmanship.</p>

      <div className="flex flex-col gap-16 text-left">
        <article className="border-b border-stone-200 pb-12">
          <p className="text-xs text-accent uppercase tracking-widest font-bold mb-3">Guide</p>
          <h2 className="text-3xl mb-4 font-serif">Planning a Destination Wedding in Islamorada</h2>
          <p className="opacity-80 mb-6 leading-relaxed max-w-2xl">
            The sun-kissed shores of the Florida Keys offer the perfect backdrop for saying &quot;I do.&quot; Discover our concierge tips for ensuring your jewelry travels safely and shines brightly.
          </p>
          <a href="#" className="text-primary text-xs uppercase tracking-widest font-bold underline">Read More</a>
        </article>

        <article className="border-b border-stone-200 pb-12">
          <p className="text-xs text-accent uppercase tracking-widest font-bold mb-3">Heritage</p>
          <h2 className="text-3xl mb-4 font-serif">The History of the Mariner Link</h2>
          <p className="opacity-80 mb-6 leading-relaxed max-w-2xl">
            A staple of nautical jewelry, the mariner link&apos;s robust design was originally forged to secure ships to port. Today, it symbolizes strength and an unbroken connection to the sea.
          </p>
          <a href="#" className="text-primary text-xs uppercase tracking-widest font-bold underline">Read More</a>
        </article>
      </div>
    </div>
  );
}
