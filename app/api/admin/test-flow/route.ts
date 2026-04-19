import { NextResponse } from 'next/server';
import { createAppointment, type ContactSubmission } from '@/lib/appointments';
import { getCalendarRuntimeConfig, createCalendarEvent } from '@/lib/google-calendar';
import { getMailRuntimeConfig, sendAppointmentNotification } from '@/lib/mailer';

/**
 * PRODUCTION SMOKE TEST ENDPOINT
 * Validates: Database -> Odoo -> Google Calendar -> Email
 */
export async function GET() {
  console.log('[SmokeTest] Initiating functional test of appointment flow...');
  
  const testSubmission: ContactSubmission = {
    name: "QA Production Master",
    email: "ceo@galantesjewelry.com",
    phone: "555-TEST",
    inquiryType: "Functional Audit",
    appointmentDate: "2026-12-31", // End of year test
    appointmentTime: "10:00 AM",
    message: "Automated verification of Google Calendar and Odoo integration."
  };

  try {
    // 1. Create in Database/Odoo
    const record = await createAppointment(testSubmission);
    console.log('[SmokeTest] Database/Odoo record created:', record.id);

    // 2. Google Calendar
    const calendarConfig = await getCalendarRuntimeConfig('production');
    const start = new Date(`${testSubmission.appointmentDate} ${testSubmission.appointmentTime}`);
    const end = new Date(start.getTime() + (calendarConfig.durationMinutes * 60000));
    
    const calendarEvent = await createCalendarEvent({
      config: calendarConfig,
      record,
      submission: testSubmission,
      start,
      end
    });
    console.log('[SmokeTest] Google Calendar Event Created:', calendarEvent.id);

    // 3. Email Notification
    const mailConfig = await getMailRuntimeConfig('production');
    const mailResult = await sendAppointmentNotification({
      config: mailConfig,
      record,
      submission: testSubmission,
      event: calendarEvent,
      start,
      end
    });
    console.log('[SmokeTest] Email Notification Dispatched:', mailResult.messageId);

    return NextResponse.json({
      status: 'success',
      appointment_id: record.id,
      google_event_id: calendarEvent.id,
      email_message_id: mailResult.messageId,
      details: 'All systems operational: Odoo, Google Calendar, and Gmail.'
    });

  } catch (error) {
    console.error('[SmokeTest] Flow FAILED:', error);
    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error during test',
      error_stack: error instanceof Error ? error.stack : null
    }, { status: 500 });
  }
}
