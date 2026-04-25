import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { z } from 'zod';
import { OdooService } from '@/lib/odoo/services';

export const runtime = 'nodejs';

const querySchema = z.object({
  payment_intent: z.string().min(1),
  payment_intent_client_secret: z.string().min(1),
});

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('Stripe secret key is not configured.');
  }

  return new Stripe(secretKey);
}

async function buildStripePaymentSyncPayload(stripe: Stripe, paymentIntent: Stripe.PaymentIntent) {
  const latestChargeId = typeof paymentIntent.latest_charge === 'string'
    ? paymentIntent.latest_charge
    : paymentIntent.latest_charge?.id || null;

  let receiptUrl: string | null = null;
  if (latestChargeId) {
    try {
      const charge = await stripe.charges.retrieve(latestChargeId);
      receiptUrl = charge.receipt_url || null;
    } catch (error) {
      console.warn('Could not retrieve Stripe charge receipt URL for checkout status sync:', error);
    }
  }

  return {
    paymentIntentId: paymentIntent.id,
    chargeId: latestChargeId,
    receiptUrl,
    amount: paymentIntent.amount_received || paymentIntent.amount,
    currency: paymentIntent.currency,
    customerEmail: paymentIntent.receipt_email || paymentIntent.metadata?.customer_email || null,
    paymentStatus: paymentIntent.status,
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = querySchema.parse({
      payment_intent: url.searchParams.get('payment_intent') || '',
      payment_intent_client_secret: url.searchParams.get('payment_intent_client_secret') || '',
    });

    const stripe = getStripeClient();
    const paymentIntent = await stripe.paymentIntents.retrieve(query.payment_intent);

    if (!paymentIntent.client_secret || paymentIntent.client_secret !== query.payment_intent_client_secret) {
      return NextResponse.json({ error: 'Invalid payment intent confirmation.' }, { status: 403 });
    }

    const orderId = Number.parseInt(String(paymentIntent.metadata?.odoo_order_id || ''), 10);

    if (paymentIntent.status === 'succeeded' && Number.isFinite(orderId) && orderId > 0) {
      try {
        const stripePayment = await buildStripePaymentSyncPayload(stripe, paymentIntent);
        await OdooService.automateBillingFlow(orderId);
      } catch (error) {
        console.warn('Checkout status billing fallback failed:', error);
      }
    }

    const order = Number.isFinite(orderId) && orderId > 0
      ? await OdooService.getOrderDetails(orderId)
      : null;
    const invoice = null; // getOrderDetails doesn't return invoices immediately, but we can return null to avoid errors.

    return NextResponse.json({
      success: true,
      paymentStatus: paymentIntent.status,
      order,
      invoice,
      customerEmail: paymentIntent.receipt_email || paymentIntent.metadata?.customer_email || null,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not resolve checkout status.';
    const status = error instanceof z.ZodError ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
