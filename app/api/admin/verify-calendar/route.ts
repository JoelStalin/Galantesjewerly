import { NextResponse } from 'next/server';
import { addAppointmentRecord } from '@/lib/appointments';
import { getCalendarRuntimeConfig, createCalendarEvent } from '@/lib/google-calendar';

export async function GET() {
  try {
    const testData = {
      name: "Prueba Calendario Final",
      email: "ceo@galantesjewelry.com",
      phone: "123456789",
      inquiryType: "Audit",
      appointmentDate: "2026-10-10",
      appointmentTime: "10:00",
      message: "Verificación de modo Co-Work",
      timezone: "America/New_York",
      durationMinutes: 60,
      status: 'received' as const,
      googleEventId: '',
      googleEventLink: '',
      odooSyncStatus: 'not_attempted' as const,
      odooPartnerId: '',
      odooAppointmentId: '',
      odooErrorMessage: '',
      emailDeliveryStatus: 'not_sent' as const,
      errorMessage: '',
      clientIp: '127.0.0.1',
      userAgent: 'SmokeTest'
    };

    const record = await addAppointmentRecord(testData);
    const config = await getCalendarRuntimeConfig('production');
    
    const start = new Date("2026-10-10T10:00:00Z");
    const end = new Date(start.getTime() + 60 * 60000);

    const event = await createCalendarEvent({
      config,
      record,
      submission: testData as any,
      start,
      end
    });

    return NextResponse.json({
      success: true,
      message: "Evento creado en el calendario del CEO",
      eventId: event.id,
      link: event.htmlLink
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}
