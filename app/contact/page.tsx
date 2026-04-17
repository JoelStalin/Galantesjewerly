import { getSettings } from "@/lib/db";
import { ContactForm } from "@/components/ContactForm";

export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const settings = await getSettings();

  return (
    <div className="max-w-4xl mx-auto py-24 px-6 flex flex-col items-center">
      <h1 className="text-5xl mb-6 text-center">Private Consultations</h1>
      <p className="text-lg opacity-80 mb-16 text-center max-w-xl">
        To provide you with the finest &quot;barefoot luxury&quot; experience, all custom designs, bridal inquiries, and complex repairs are handled via private consultation.
      </p>

      <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-16">
        <div>
          <h3 className="text-2xl mb-4 font-serif">Visit the Boutique</h3>
          <p className="text-sm opacity-80 mb-6 leading-relaxed whitespace-pre-line">
            {settings.contact_address || "Islamorada, Florida Keys\n123 Overseas Highway"}<br />
            (By Appointment Preferred)
          </p>
          <h3 className="text-2xl mb-4 font-serif mt-8">Direct Contact</h3>
          <p className="text-sm opacity-80 leading-relaxed">
            Phone: {settings.contact_phone || "(305) 555-0199"}<br />
            Email: {settings.contact_email || "concierge@galantesjewelry.com"}
          </p>
        </div>

        <div>
           <ContactForm />
        </div>
      </div>
    </div>
  );
}
