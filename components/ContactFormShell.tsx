"use client";

import dynamic from "next/dynamic";

const ContactForm = dynamic(
  () => import("@/components/ContactForm").then((module) => module.ContactForm),
  {
    ssr: false,
    loading: () => (
      <div className="rounded border border-stone-200 bg-stone-50 px-4 py-6 text-sm text-stone-600">
        Loading consultation form...
      </div>
    ),
  },
);

export function ContactFormShell() {
  return <ContactForm />;
}
