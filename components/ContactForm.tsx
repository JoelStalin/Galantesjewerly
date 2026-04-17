"use client";

import { FormEvent, useMemo, useState } from "react";

type AvailabilityResponse = {
  availableSlots?: Array<{ time: string; label: string }>;
  timezone?: string;
  durationMinutes?: number;
  startTime?: string;
  endTime?: string;
  slotIntervalMinutes?: number;
  availableWeekdays?: number[];
  error?: string;
};

const weekdayLabels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function getTodayForDateInput() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

function formatWeekdays(weekdays: number[]) {
  if (weekdays.length === 7) {
    return "Appointments are available every day.";
  }

  return `Appointments are offered on ${weekdays.map((day) => weekdayLabels[day]).join(", ")}.`;
}

export function ContactForm() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [availabilityError, setAvailabilityError] = useState("");
  const [availability, setAvailability] = useState<AvailabilityResponse>({
    availableSlots: [],
    availableWeekdays: [],
  });

  const scheduleSummary = useMemo(() => {
    const parts: string[] = [];

    if (availability.durationMinutes) {
      parts.push(`${availability.durationMinutes}-minute consultations`);
    }

    if (availability.startTime && availability.endTime) {
      parts.push(`${availability.startTime} to ${availability.endTime}`);
    }

    if (availability.timezone) {
      parts.push(availability.timezone);
    }

    return parts.join(" | ");
  }, [availability.durationMinutes, availability.endTime, availability.startTime, availability.timezone]);

  const loadAvailability = async (appointmentDate: string) => {
    setSelectedTime("");
    setAvailabilityError("");
    setAvailability((current) => ({ ...current, availableSlots: [] }));

    if (!appointmentDate) {
      return;
    }

    setLoadingAvailability(true);

    try {
      const response = await fetch(`/api/contact/availability?appointmentDate=${encodeURIComponent(appointmentDate)}`, {
        cache: "no-store",
      });
      const result: AvailabilityResponse = await response.json();

      if (!response.ok) {
        throw new Error(
          response.status === 503
            ? "Online booking is temporarily unavailable. Please contact the boutique directly and we will arrange your visit."
            : result.error || "Could not load appointment availability.",
        );
      }

      setAvailability({
        availableSlots: result.availableSlots || [],
        timezone: result.timezone,
        durationMinutes: result.durationMinutes,
        startTime: result.startTime,
        endTime: result.endTime,
        slotIntervalMinutes: result.slotIntervalMinutes,
        availableWeekdays: result.availableWeekdays || [],
      });

      if (!result.availableSlots?.length) {
        setAvailabilityError("No consultation times are currently available for that date. Please choose another day.");
      }
    } catch (caughtError) {
      setAvailabilityError(
        caughtError instanceof Error
          ? caughtError.message
          : "We could not load available appointment times.",
      );
    } finally {
      setLoadingAvailability(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setConfirmation("");

    if (!selectedDate) {
      setError("Please choose a preferred date first.");
      setLoading(false);
      return;
    }

    if (!selectedTime) {
      setError("Please choose one of the available consultation times.");
      setLoading(false);
      return;
    }

    const formData = new FormData(e.target as HTMLFormElement);
    const data = {
      name: formData.get("name"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      inquiryType: formData.get("inquiryType"),
      message: formData.get("message"),
      appointmentDate: selectedDate,
      appointmentTime: selectedTime,
      honeypot: formData.get("company"),
    };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (res.ok) {
        setSubmitted(true);
        setConfirmation(result.message || "Appointment request created successfully.");
      } else {
        setError(
          res.status === 409
            ? "That consultation time was just booked. Please choose another available time."
            : res.status === 503
              ? "Online booking is temporarily unavailable. Please contact the boutique directly and we will arrange your visit."
              : result.error || "We could not submit your request right now. Please try again in a moment.",
        );
        if (res.status === 409 && selectedDate) {
          await loadAvailability(selectedDate);
        }
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
            <div className="bg-red-50 border border-red-200 text-red-600 p-3 text-sm mb-2">
              <span data-testid="contact-error">{error}</span>
            </div>
          )}

          <div className="rounded border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
            <p className="font-medium text-stone-900">Choose a date and we will show you the times that are still open.</p>
            <p className="mt-1 text-xs text-stone-500">
              {availability.availableWeekdays?.length ? formatWeekdays(availability.availableWeekdays) : "Available consultation times load after you choose a date."}
            </p>
            {scheduleSummary && <p className="mt-1 text-xs text-stone-500">{scheduleSummary}</p>}
          </div>

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

          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-widest font-semibold opacity-70">Preferred Date</label>
            <input
              data-testid="contact-appointment-date"
              required
              name="appointmentDate"
              type="date"
              value={selectedDate}
              min={getTodayForDateInput()}
              onChange={async (event) => {
                const nextDate = event.target.value;
                setSelectedDate(nextDate);
                await loadAvailability(nextDate);
              }}
              className="border-b border-stone-300 pb-2 focus:outline-none focus:border-primary bg-transparent"
            />
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <label className="text-xs uppercase tracking-widest font-semibold opacity-70">Available Times</label>
              {loadingAvailability && <span data-testid="contact-availability-loading" className="text-xs text-stone-500">Checking calendar...</span>}
            </div>

            <input data-testid="contact-appointment-time" required name="appointmentTime" type="hidden" value={selectedTime} readOnly />

            {!selectedDate ? (
              <div className="rounded border border-dashed border-stone-300 px-4 py-4 text-sm text-stone-500">
                Select a date to see the consultation times that are available.
              </div>
            ) : availabilityError ? (
              <div data-testid="contact-availability-error" className="rounded border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-700">
                {availabilityError}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {(availability.availableSlots || []).map((slot) => {
                  const isSelected = slot.time === selectedTime;
                  return (
                    <button
                      key={slot.time}
                      type="button"
                      data-testid={`contact-slot-${slot.time.replace(":", "-")}`}
                      onClick={() => setSelectedTime(slot.time)}
                      className={`rounded border px-3 py-3 text-sm transition-colors ${isSelected ? "border-primary bg-primary text-white" : "border-stone-300 bg-white text-stone-700 hover:border-primary hover:text-primary"}`}
                    >
                      {slot.label}
                    </button>
                  );
                })}
              </div>
            )}

            {selectedTime && (
              <p data-testid="contact-selected-slot" className="text-sm text-stone-600">
                Selected consultation time: <span className="font-medium text-stone-900">{availability.availableSlots?.find((slot) => slot.time === selectedTime)?.label || selectedTime}</span>
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-widest font-semibold opacity-70">Message</label>
            <textarea data-testid="contact-message" required name="message" rows={4} className="border-b border-stone-300 pb-2 focus:outline-none focus:border-primary bg-transparent" placeholder="Tell us what you would like to explore during your visit."></textarea>
          </div>
          <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
          <button data-testid="contact-submit" type="submit" disabled={loading || loadingAvailability || !selectedTime} className="bg-primary text-white py-4 mt-4 text-xs uppercase tracking-widest font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50">
            {loading ? "Requesting Appointment..." : "Request Appointment"}
          </button>
        </form>
      )}
    </div>
  );
}
