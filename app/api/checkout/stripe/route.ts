import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { z } from 'zod';
import { OdooService } from '@/lib/odoo/services';
import { ShippingEngine } from '@/lib/shipping/engine';
import { getSettings } from '@/lib/db';
import { validateShippingCity } from '@/lib/shipping-settings';

export const runtime = 'nodejs';

const shippingRateSelectionSchema = z.object({
  carrier: z.enum(['pickup', 'usps', 'ups', 'fedex']),
  serviceName: z.string().min(1),
});

const checkoutSchema = z.object({
  items: z.array(z.object({
    id: z.union([z.string(), z.number()]).optional(),
    product_id: z.union([z.string(), z.number()]).optional(),
    price: z.number().nonnegative(),
    quantity: z.number().int().positive(),
  })).min(1),
  customerData: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
    street: z.string().min(1),
    city: z.string().min(1),
    state: z.string().optional().default(''),
    zip: z.string().min(1),
    country: z.string().optional().default('United States'),
  }),
  shippingRate: shippingRateSelectionSchema.optional(),
});

const SHIPPING_PRODUCT_DEFAULT_CODE = 'GJ-SHP-001';

async function getShippingSettingsWithFallback(timeoutMs = 1200) {
  try {
    const settingsPromise = getSettings();
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), timeoutMs);
    });
    return await Promise.race([settingsPromise, timeoutPromise]) || {};
  } catch {
    return {};
  }
}

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('Stripe secret key is not configured.');
  }

  return new Stripe(secretKey);
}

function parseProductId(value: string | number | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const payload = checkoutSchema.parse(await request.json());
    const { items, customerData, shippingRate } = payload;

    const subtotal = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const shippingAddress = {
      street: customerData.street,
      city: customerData.city,
      state: customerData.state,
      zip: customerData.zip,
      country: customerData.country,
    };

    const settings = await getShippingSettingsWithFallback();
    const cityCheck = validateShippingCity(settings, shippingAddress.city);
    if (!cityCheck.valid) {
      return NextResponse.json({ error: cityCheck.message || 'Shipping is not available for the selected city.' }, { status: 400 });
    }

    const availableRates = await ShippingEngine.getRates(shippingAddress, {
      weightLbs: 1,
      value: subtotal,
    });
    const selectedRate = shippingRate
      ? availableRates.find((rate) => rate.carrier === shippingRate.carrier && rate.serviceName === shippingRate.serviceName)
      : availableRates.find((rate) => rate.carrier !== 'pickup') || availableRates[0];

    if (!selectedRate) {
      return NextResponse.json({ error: 'Selected shipping method is not available for this address.' }, { status: 400 });
    }

    if (!selectedRate.insuranceIncluded || selectedRate.insuranceValue < subtotal) {
      return NextResponse.json({ error: 'Selected shipping method does not meet jewelry insurance requirements.' }, { status: 400 });
    }

    const shippingProductId = await OdooService.getProductVariantIdByDefaultCode(SHIPPING_PRODUCT_DEFAULT_CODE);
    if (!shippingProductId) {
      return NextResponse.json({ error: 'Secure shipping product is not configured in Odoo.' }, { status: 500 });
    }

    const partnerId = await OdooService.findOrCreateCustomer({
      name: customerData.name,
      email: customerData.email,
      phone: customerData.phone,
      street: customerData.street,
      city: customerData.city,
      zip: customerData.zip,
    });
    if (!partnerId) {
      return NextResponse.json({ error: 'Unable to create or locate the Odoo customer record.' }, { status: 500 });
    }

    const orderLines: Array<{
      product_id: number;
      product_uom_qty: number;
      price_unit: number;
      name?: string;
    }> = items.map((item, index) => {
      const productId = parseProductId(item.product_id ?? item.id);
      if (!productId) {
        throw new Error(`Cart item ${index + 1} is missing a valid Odoo product ID. Re-open the product from the live catalog and add it again.`);
      }

      return {
        product_id: productId,
        product_uom_qty: item.quantity,
        price_unit: item.price,
      };
    });

    orderLines.push({
      product_id: shippingProductId,
      product_uom_qty: 1,
      price_unit: selectedRate.price,
      name: selectedRate.serviceName,
    });

    const orderId = await OdooService.createOrder(partnerId, orderLines);
    if (!orderId) {
      return NextResponse.json({ error: 'Unable to create the Odoo order.' }, { status: 500 });
    }

    const stripe = getStripeClient();
    const amount = subtotal + selectedRate.price;
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        odoo_partner_id: partnerId.toString(),
        odoo_order_id: orderId.toString(),
        customer_email: customerData.email,
        shipping_carrier: selectedRate.carrier,
        shipping_service_name: selectedRate.serviceName,
        shipping_amount: selectedRate.price.toFixed(2),
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      orderId,
      shippingRate: selectedRate,
      orderTotal: amount,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid checkout details.' }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : 'Stripe checkout failed.';
    console.error('Stripe Checkout Error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
