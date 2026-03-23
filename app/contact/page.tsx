"use client";

import { FormEvent, useState } from "react";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

  // Note: In production, send this form to an API route to save to the local JSON/SQLite db.
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="max-w-4xl mx-auto py-24 px-6 flex flex-col items-center">
      <h1 className="text-5xl mb-6 text-center">Private Consultations</h1>
      <p className="text-lg opacity-80 mb-16 text-center max-w-xl">
        To provide you with the finest "barefoot luxury" experience, all custom designs, bridal inquiries, and complex repairs are handled via private consultation.
      </p>

      <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-16">
        <div>
          <h3 className="text-2xl mb-4 font-serif">Visit the Boutique</h3>
          <p className="text-sm opacity-80 mb-6 leading-relaxed">
            Islamorada, Florida Keys<br />
            123 Overseas Highway<br />
            (By Appointment Preferred)
          </p>
          <h3 className="text-2xl mb-4 font-serif mt-8">Direct Contact</h3>
          <p className="text-sm opacity-80 leading-relaxed">
            Phone: (305) 555-0199<br />
            Email: concierge@galantesjewelry.com
          </p>
        </div>

        <div>
          {submitted ? (
             <div className="bg-stone-50 p-8 text-center border border-stone-200">
               <h3 className="text-2xl font-serif mb-2 text-primary">Request Received</h3>
               <p className="opacity-80 text-sm">Our concierge will contact you shortly to confirm your appointment time. Warm regards from the Florida Keys.</p>
             </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-widest font-semibold opacity-70">Name</label>
                <input required type="text" className="border-b border-stone-300 pb-2 focus:outline-none focus:border-primary bg-transparent" placeholder="Your full name" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-widest font-semibold opacity-70">Email</label>
                <input required type="email" className="border-b border-stone-300 pb-2 focus:outline-none focus:border-primary bg-transparent" placeholder="Your email address" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-widest font-semibold opacity-70">Inquiry Type</label>
                <select className="border-b border-stone-300 pb-2 focus:outline-none focus:border-primary bg-transparent appearance-none">
                  <option>Bridal & Engagement</option>
                  <option>Nautical Collections</option>
                  <option>Master Repair Service</option>
                  <option>General Inquiry</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-widest font-semibold opacity-70">Message</label>
                <textarea rows={4} className="border-b border-stone-300 pb-2 focus:outline-none focus:border-primary bg-transparent" placeholder="How can we assist you?"></textarea>
              </div>
              <button type="submit" className="bg-primary text-white py-4 mt-4 text-xs uppercase tracking-widest font-semibold hover:bg-primary-dark transition-colors">
                Request Appointment
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
