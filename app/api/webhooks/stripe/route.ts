import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('Stripe secret key is not configured.');
  }

  return new Stripe(secretKey);
}

export async function POST(request: Request) {
  const body = await request.text();
  const sig = (await headers()).get('stripe-signature');
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !endpointSecret) {
    return NextResponse.json({ error: 'Stripe webhook is not configured.' }, { status: 503 });
  }

  let event: Stripe.Event;

  try {
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook signature verification failed.';
    console.error('Webhook signature verification failed:', message);
    return NextResponse.json({ error: 'Webhook Error' }, { status: 400 });
  }

  // Handle the event
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const partnerId = parseInt(paymentIntent.metadata.odoo_partner_id);
    const orderId = parseInt(paymentIntent.metadata.odoo_order_id);

    console.log(`Payment successful for partner ${partnerId}, Order ${orderId}. Automating Odoo Billing...`);

    try {
      const { OdooService } = await import('@/lib/odoo/services');
      const result = await OdooService.automateBillingFlow(orderId);
      console.log(`Odoo billing automation complete: Order ${result.orderId}, Invoice ${result.invoiceId}`);
    } catch (error) {
      console.error('Failed to automate billing flow in Odoo:', error);
      // We return 200 anyway to Stripe to avoid retries, but we should have alerted here
    }
  }

  return NextResponse.json({ received: true });
}
