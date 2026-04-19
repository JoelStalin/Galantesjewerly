import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { OdooService } from '@/lib/odoo/services';

type CheckoutItem = {
  price: number;
  quantity: number;
};

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('Stripe secret key is not configured.');
  }

  return new Stripe(secretKey);
}

export async function POST(request: Request) {
  try {
    const { items, customerData } = await request.json() as {
      items: CheckoutItem[];
      customerData: {
        name: string;
        email: string;
        phone?: string;
      };
    };

    // 1. Calculate total (Server-side validation)
    const amount = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);

    // 2. Sync with Odoo (Guest or Auth)
    const partnerId = await OdooService.findOrCreateCustomer({
      name: customerData.name,
      email: customerData.email,
      phone: customerData.phone,
    });

    // 3. Create Draft Order in Odoo
    const orderLines = items.map(item => ({
      product_id: 1, // Defaulting to a generic product for now if ID is missing
      // In a real scenario, items would contain the actual Odoo product_id
      product_uom_qty: item.quantity,
      price_unit: item.price,
    }));

    const orderId = await OdooService.createOrder(partnerId, orderLines);

    // 4. Create Stripe Payment Intent
    const stripe = getStripeClient();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Stripe expects cents
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        odoo_partner_id: partnerId.toString(),
        odoo_order_id: orderId.toString(),
        customer_email: customerData.email,
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      orderId: orderId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Stripe checkout failed.';
    console.error('Stripe Checkout Error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
