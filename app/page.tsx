import { getAllSections, getFeaturedItems } from "@/lib/db";
import { FeaturedCarousel } from "@/components/FeaturedCarousel";

export const dynamic = "force-dynamic";

export default async function Home() {
  const sections = await getAllSections();
  const featured = await getFeaturedItems();
  
  const getSection = (id: string) => sections.find(s => s.section_identifier === id);

  const hero = getSection('hero');
  const philosophy = getSection('philosophy');
  const review = getSection('review');
  const cta = getSection('cta');

  return (
    <div className="flex flex-col items-center w-full">
      {/* Hero Section */}
      <section className="relative w-full h-[80vh] min-h-[600px] flex flex-col justify-center items-center text-center px-4 text-white overflow-hidden">
        <div
          className="absolute inset-0 z-0 bg-cover bg-center transition-all duration-1000"
          style={{ backgroundImage: `url('${hero?.image_url || ""}')` }}
        ></div>
        {/* Gradient overlay: transparent at top, subtle dark at bottom for text legibility */}
        <div className="absolute inset-0 z-0 bg-gradient-to-t from-black/60 via-black/20 to-black/10"></div>
        <div className="z-10 max-w-5xl mx-auto flex flex-col items-center">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif text-accent mb-6 leading-tight drop-shadow-lg">
            {hero?.title}
          </h1>
          <p className="text-lg md:text-2xl font-light tracking-wide mb-10 text-white drop-shadow-md max-w-3xl whitespace-pre-wrap">
            {hero?.content_text}
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            {hero?.action_text && (
               <a href={hero.action_link || "#"} className="bg-accent text-primary-dark px-8 py-4 text-sm uppercase tracking-widest font-semibold hover:bg-accent-light transition-colors">
                 {hero.action_text}
               </a>
            )}
            <a href="/collections" className="border border-accent text-accent px-8 py-4 text-sm uppercase tracking-widest font-semibold hover:bg-accent hover:text-primary-dark transition-colors backdrop-blur-sm bg-black/20">
              Explore Collections
            </a>
          </div>
        </div>
      </section>

      {/* Philosophy Section */}
      <section className="py-24 px-6 md:px-12 max-w-5xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl mb-6">{philosophy?.title}</h2>
        <p className="text-lg opacity-80 leading-relaxed max-w-3xl mx-auto whitespace-pre-wrap">
          {philosophy?.content_text}
        </p>
      </section>

      {/* Featured Services Grid / Carousel */}
      <section className="w-full bg-white py-24 px-6 md:px-12">
        <FeaturedCarousel items={featured} />
      </section>

      {/* Review Proof */}
      <section className="w-full py-24 bg-stone-50 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl mb-12">{review?.title}</h2>
          <blockquote className="text-xl md:text-2xl font-serif text-primary italic leading-relaxed mb-6">
            {review?.content_text}
          </blockquote>
          <cite className="block text-sm uppercase tracking-widest font-semibold text-accent not-italic">{review?.subtitle}</cite>
        </div>
      </section>

      {/* Final CTA */}
      <section className="w-full py-32 px-6 flex flex-col items-center justify-center bg-primary text-white text-center">
        <h2 className="text-4xl md:text-5xl text-accent mb-6">{cta?.title}</h2>
        <p className="max-w-2xl text-lg opacity-80 mb-10 whitespace-pre-wrap">
          {cta?.content_text}
        </p>
        <a href={cta?.action_link || "/contact"} className="bg-accent text-primary-dark px-10 py-5 text-sm uppercase tracking-widest font-bold hover:bg-accent-light transition-colors">
          {cta?.action_text}
        </a>
      </section>
    </div>
  );
}
