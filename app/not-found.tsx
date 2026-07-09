import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-6 py-24 text-center md:px-12">
      <p className="text-xs font-semibold uppercase tracking-[0.32em] text-accent">404</p>
      <h1 className="mt-4 font-serif text-4xl text-primary md:text-5xl">Page not found</h1>
      <p className="mt-6 max-w-xl text-sm leading-7 text-foreground/70 md:text-base">
        The page you requested is not part of the current Galante&apos;s Jewelry experience.
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/"
          className="rounded-full bg-primary px-6 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-white transition hover:bg-primary/90"
        >
          Return Home
        </Link>
        <Link
          href="/contact"
          className="rounded-full border border-primary/20 px-6 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-primary transition hover:border-accent hover:text-accent"
        >
          Contact Boutique
        </Link>
      </div>
    </section>
  );
}
