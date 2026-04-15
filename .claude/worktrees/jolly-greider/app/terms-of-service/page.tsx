import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service | Galantes Jewelry',
  description: 'Terms for using Galantes Jewelry website, appointments, and account access.',
};

export default function TermsOfServicePage() {
  return (
    <section className="px-6 py-16 md:px-12">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Terms of Service</p>
        <h1 className="mt-4 text-4xl text-primary">Galantes Jewelry Terms of Service</h1>
        <p className="mt-4 text-sm leading-7 text-zinc-600">Effective date: April 11, 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-7 text-zinc-700">
          <section>
            <h2 className="text-2xl text-primary">Use of the Website</h2>
            <p className="mt-3">
              The Galantes Jewelry website provides information about jewelry collections, bridal services,
              repairs, consultations, and customer account access. Customers agree to use the site lawfully and
              to provide accurate information when requesting services or appointments.
            </p>
          </section>

          <section>
            <h2 className="text-2xl text-primary">Accounts and Google Sign-In</h2>
            <p className="mt-3">
              Customers may use Google sign-in to access account features. Customers are responsible for keeping
              their Google account secure and for notifying Galantes Jewelry about unauthorized use related to
              their Galantes Jewelry account.
            </p>
          </section>

          <section>
            <h2 className="text-2xl text-primary">Appointments and Services</h2>
            <p className="mt-3">
              Appointment requests are subject to confirmation by Galantes Jewelry. Product availability,
              service timelines, repair estimates, and custom jewelry details may vary based on consultation,
              inspection, materials, and customer approvals.
            </p>
          </section>

          <section>
            <h2 className="text-2xl text-primary">Intellectual Property</h2>
            <p className="mt-3">
              Site content, branding, images, text, designs, and related materials are owned by Galantes Jewelry
              or used with permission. Customers may not copy, resell, or misuse site materials without written
              permission.
            </p>
          </section>

          <section>
            <h2 className="text-2xl text-primary">Privacy</h2>
            <p className="mt-3">
              Use of customer information is described in the{' '}
              <Link href="/privacy-policy" className="text-primary underline decoration-accent underline-offset-4">
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-2xl text-primary">Contact</h2>
            <p className="mt-3">
              Questions about these terms can be sent to concierge@galantesjewelry.com or through the{' '}
              <Link href="/contact" className="text-primary underline decoration-accent underline-offset-4">
                contact page
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </section>
  );
}
