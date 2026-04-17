import { getAllSections, getFeaturedItems } from "@/lib/db";
import { getOdooClient } from '@/lib/odoo/client';
import { FeaturedCarousel } from "@/components/FeaturedCarousel";
import { ProductGrid } from '@/components/shop/ProductGrid';

export const dynamic = "force-dynamic";

export default async function Home() {
  const sections = await getAllSections();
  const featured = await getFeaturedItems();
  const client = getOdooClient();
  const featuredProducts = await client.getFeaturedProducts(6);

  const getSection = (id: string) => sections.find(s => s.section_identifier === id);

  const hero = getSection('hero');
  const philosophy = getSection('philosophy');
  const review = getSection('review');
  const cta = getSection('cta');

  return (
    <div className="flex flex-col items-center w-full">
      {/* Hero Section */}
      <section className="relative w-full h-[80vh] min-h-[600px] flex flex-col justify-end text-white overflow-hidden">
        <div
          className="absolute inset-0 z-0 bg-cover bg-center transition-all duration-1000"
          style={{ backgroundImage: `url('${hero?.image_url || ""}')` }}
        ></div>
        {/* Gradient: fuerte abajo-izquierda, transparente arriba-derecha para no tapar el rostro */}
        <div className="absolute inset-0 z-0 bg-gradient-to-tr from-black/75 via-black/30 to-transparent"></div>
        <div className="z-10 w-full max-w-2xl px-8 md:px-16 pb-14 md:pb-20">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif text-accent mb-4 leading-tight drop-shadow-lg">
            {hero?.title}
          </h1>
          <p className="text-base md:text-xl font-light tracking-wide mb-8 text-white/90 drop-shadow-md whitespace-pre-wrap">
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

      <section className="w-full bg-stone-50 py-24 px-6 md:px-12">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12 text-center">
            <p className="text-sm uppercase tracking-[0.35em] text-accent mb-4">Featured Jewelry</p>
            <h2 className="text-4xl font-serif font-bold text-gray-900">Live product collection from Odoo</h2>
            <p className="mt-4 text-gray-600 max-w-3xl mx-auto">
              These products are pulled directly from the Odoo catalog, including real-time availability and buying links.
            </p>
          </div>

          {featuredProducts.length > 0 ? (
            <ProductGrid products={featuredProducts} columns={3} />
          ) : (
            <div className="rounded-3xl border border-gray-200 bg-white px-10 py-12 text-center">
              <h3 className="text-2xl font-semibold text-gray-900 mb-3">Products are loading</h3>
              <p className="text-gray-600">
                We&apos;re connecting to our Odoo shop. Please refresh if the products do not appear.
              </p>
            </div>
          )}
        </div>
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
