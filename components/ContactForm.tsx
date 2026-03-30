"use client";

import { FormEvent, useState } from "react";

export function ContactForm() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.target as HTMLFormElement);
    const data = {
      name: formData.get("name"),
      email: formData.get("email"),
      inquiryType: formData.get("inquiryType"),
      message: formData.get("message"),
    };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        const result = await res.json();
        setError(result.error || "Failed to send request. Please try again.");
      }
    } catch {
      setError("A connection error occurred. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {submitted ? (
        <div className="bg-stone-50 p-8 text-center border border-stone-200 animate-in fade-in duration-500">
          <h3 className="text-2xl font-serif mb-2 text-primary">Request Received</h3>
          <p className="opacity-80 text-sm">Our concierge will contact you shortly to confirm your appointment time. Warm regards from the Florida Keys.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 p-3 text-xs mb-2">
              {error}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-widest font-semibold opacity-70">Name</label>
            <input required name="name" type="text" className="border-b border-stone-300 pb-2 focus:outline-none focus:border-primary bg-transparent" placeholder="Your full name" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-widest font-semibold opacity-70">Email</label>
            <input required name="email" type="email" className="border-b border-stone-300 pb-2 focus:outline-none focus:border-primary bg-transparent" placeholder="Your email address" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-widest font-semibold opacity-70">Inquiry Type</label>
            <select name="inquiryType" className="border-b border-stone-300 pb-2 focus:outline-none focus:border-primary bg-transparent appearance-none">
              <option value="Bridal & Engagement">Bridal & Engagement</option>
              <option value="Nautical Collections">Nautical Collections</option>
              <option value="Master Repair Service">Master Repair Service</option>
              <option value="General Inquiry">General Inquiry</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-widest font-semibold opacity-70">Message</label>
            <textarea required name="message" rows={4} className="border-b border-stone-300 pb-2 focus:outline-none focus:border-primary bg-transparent" placeholder="How can we assist you?"></textarea>
          </div>
          <button type="submit" disabled={loading} className="bg-primary text-white py-4 mt-4 text-xs uppercase tracking-widest font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50">
            {loading ? "Sending..." : "Request Appointment"}
          </button>
        </form>
      )}
    </div>
  );
}
