import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, inquiryType, message } = body;
    const settings = await getSettings();
    const recipient = settings.appointment_email || 'appointments@galantesjewelry.com';

    // In a real production environment, you would use nodemailer or a service like Resend/SendGrid.
    // For now, we simulate the logic and log the action.
    console.log(`[APPOINTMENT] New request from ${name} (${email}) for ${inquiryType}`);
    console.log(`[APPOINTMENT] Message: ${message}`);
    console.log(`[APPOINTMENT] Sending notification to: ${recipient}`);

    // You could also save this to a data/appointments.json file if needed.
    
    return NextResponse.json({ success: true, message: 'Request received and notification simulated.' });
  } catch (error) {
    console.error('[API/CONTACT] Error handling submission:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
