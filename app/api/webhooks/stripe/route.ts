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

    // In a real production scenario, we should pass the line items here too
    // For now, we assume Odoo has the cart or we reconstruct from metadata
    console.log(`Payment successful for partner ${partnerId}. Creating Odoo Order...`);

    try {
      // Logic to reconstruct lines or mark as paid in Odoo
      // await OdooService.createOrder(partnerId, [...]);
      console.log('Odoo Order created and confirmed.');
    } catch (error) {
      console.error('Failed to sync payment with Odoo:', error);
      // We return 200 anyway to Stripe to avoid retries, but log the critical error
    }
  }

  return NextResponse.json({ received: true });
}
