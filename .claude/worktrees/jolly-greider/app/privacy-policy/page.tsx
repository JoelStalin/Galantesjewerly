import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy | Galantes Jewelry',
  description: 'Privacy practices for Galantes Jewelry accounts, appointments, and Google sign-in.',
};

export default function PrivacyPolicyPage() {
  return (
    <section className="px-6 py-16 md:px-12">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Privacy Policy</p>
        <h1 className="mt-4 text-4xl text-primary">Galantes Jewelry Privacy Policy</h1>
        <p className="mt-4 text-sm leading-7 text-zinc-600">Effective date: April 11, 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-7 text-zinc-700">
          <section>
            <h2 className="text-2xl text-primary">Information We Collect</h2>
            <p className="mt-3">
              Galantes Jewelry collects information that customers provide when requesting appointments,
              contacting our team, creating an account, or signing in with Google. This may include name,
              email address, phone number, appointment preferences, and messages submitted through the site.
            </p>
          </section>

          <section>
            <h2 className="text-2xl text-primary">Google Sign-In Data</h2>
            <p className="mt-3">
              When a customer chooses Google sign-in, Galantes Jewelry requests only the minimum profile
              information needed to create or access an account: openid, email, and profile. This can include
              Google account ID, email address, email verification status, name, and profile image.
            </p>
          </section>

          <section>
            <h2 className="text-2xl text-primary">How We Use Information</h2>
            <p className="mt-3">
              We use customer information to authenticate accounts, respond to requests, schedule consultations,
              provide jewelry services, prevent fraud, improve site reliability, and communicate about customer
              service matters. We do not sell Google user data.
            </p>
          </section>

          <section>
            <h2 className="text-2xl text-primary">Sharing and Retention</h2>
            <p className="mt-3">
              We share information only with service providers that help operate the website, process customer
              requests, secure the service, or comply with legal obligations. Customer and Google profile data
              is retained only as long as needed for account access, service history, security, and legal records.
            </p>
          </section>

          <section>
            <h2 className="text-2xl text-primary">Security</h2>
            <p className="mt-3">
              Administrative credentials, OAuth client secrets, tokens, and API keys are stored on backend systems
              and protected from frontend exposure. Sensitive integration values are encrypted at rest and admin
              access is restricted.
            </p>
          </section>

          <section>
            <h2 className="text-2xl text-primary">Your Choices</h2>
            <p className="mt-3">
              Customers may request access, correction, or deletion of account information by contacting
              concierge@galantesjewelry.com. Customers may also revoke Google account access from their Google
              Account permissions page.
            </p>
          </section>

          <section>
            <h2 className="text-2xl text-primary">Contact</h2>
            <p className="mt-3">
              Privacy questions can be sent to concierge@galantesjewelry.com or through the{' '}
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
