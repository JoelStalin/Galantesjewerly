"use client";

import { FormEvent, useState } from "react";

export function ContactForm() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setConfirmation("");

    const formData = new FormData(e.target as HTMLFormElement);
    const data = {
      name: formData.get("name"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      inquiryType: formData.get("inquiryType"),
      message: formData.get("message"),
      appointmentDate: formData.get("appointmentDate"),
      appointmentTime: formData.get("appointmentTime"),
      honeypot: formData.get("company"),
    };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        const result = await res.json();
        setSubmitted(true);
        setConfirmation(result.message || "Appointment request created successfully.");
      } else {
        const result = await res.json();
        setError(
          res.status === 409
            ? "That appointment time is already booked. Please select another date or time."
            : result.error || "Failed to send request. Please try again.",
        );
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
        <div data-testid="contact-success" className="bg-stone-50 p-8 text-center border border-stone-200 animate-in fade-in duration-500">
          <h3 className="text-2xl font-serif mb-2 text-primary">Request Received</h3>
          <p className="opacity-80 text-sm">{confirmation || "Our concierge will contact you shortly to confirm your appointment time. Warm regards from the Florida Keys."}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 p-3 text-xs mb-2">
              <span data-testid="contact-error">{error}</span>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-widest font-semibold opacity-70">Name</label>
            <input data-testid="contact-name" required name="name" type="text" className="border-b border-stone-300 pb-2 focus:outline-none focus:border-primary bg-transparent" placeholder="Your full name" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-widest font-semibold opacity-70">Email</label>
            <input data-testid="contact-email" required name="email" type="email" className="border-b border-stone-300 pb-2 focus:outline-none focus:border-primary bg-transparent" placeholder="Your email address" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-widest font-semibold opacity-70">Phone</label>
            <input data-testid="contact-phone" name="phone" type="tel" className="border-b border-stone-300 pb-2 focus:outline-none focus:border-primary bg-transparent" placeholder="Optional phone number" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-widest font-semibold opacity-70">Inquiry Type</label>
            <select data-testid="contact-inquiry-type" name="inquiryType" className="border-b border-stone-300 pb-2 focus:outline-none focus:border-primary bg-transparent appearance-none">
              <option value="Bridal & Engagement">Bridal & Engagement</option>
              <option value="Nautical Collections">Nautical Collections</option>
              <option value="Master Repair Service">Master Repair Service</option>
              <option value="General Inquiry">General Inquiry</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase tracking-widest font-semibold opacity-70">Preferred Date</label>
              <input data-testid="contact-appointment-date" required name="appointmentDate" type="date" min={new Date().toISOString().slice(0, 10)} className="border-b border-stone-300 pb-2 focus:outline-none focus:border-primary bg-transparent" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase tracking-widest font-semibold opacity-70">Preferred Time</label>
              <input data-testid="contact-appointment-time" required name="appointmentTime" type="time" min="09:00" max="18:00" step="900" className="border-b border-stone-300 pb-2 focus:outline-none focus:border-primary bg-transparent" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-widest font-semibold opacity-70">Message</label>
            <textarea data-testid="contact-message" required name="message" rows={4} className="border-b border-stone-300 pb-2 focus:outline-none focus:border-primary bg-transparent" placeholder="How can we assist you?"></textarea>
          </div>
          <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
          <button data-testid="contact-submit" type="submit" disabled={loading} className="bg-primary text-white py-4 mt-4 text-xs uppercase tracking-widest font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50">
            {loading ? "Checking Calendar..." : "Request Appointment"}
          </button>
        </form>
      )}
    </div>
  );
}
