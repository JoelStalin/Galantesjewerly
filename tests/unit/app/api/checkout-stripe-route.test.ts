/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findOrCreateCustomer: vi.fn(),
  createOrder: vi.fn(),
  getOrderDetails: vi.fn(),
  paymentIntentCreate: vi.fn(),
}));

vi.mock('@/lib/odoo/services', () => ({
  OdooService: {
    findOrCreateCustomer: mocks.findOrCreateCustomer,
    createOrder: mocks.createOrder,
    getOrderDetails: mocks.getOrderDetails,
  },
}));

vi.mock('stripe', () => {
  class Stripe {
    paymentIntents = {
      create: mocks.paymentIntentCreate,
    };
  }

  return { default: Stripe };
});

describe('POST /api/checkout/stripe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123');
  });

  it('creates an Odoo order and Stripe payment intent from valid cart data', async () => {
    mocks.findOrCreateCustomer.mockResolvedValue(44);
    mocks.createOrder.mockResolvedValue(55);
    mocks.getOrderDetails.mockResolvedValue({ id: 55, amount_total: 2875 });
    mocks.paymentIntentCreate.mockResolvedValue({ client_secret: 'pi_test_secret' });

    const { POST } = await import('@/app/api/checkout/stripe/route');

    const response = await POST(new Request('http://localhost/api/checkout/stripe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [
          {
            id: '12',
            product_id: '12',
            name: 'The Islamorada Solitaire',
            price: 1250,
            quantity: 2,
          },
        ],
        customerData: {
          name: 'Ana Buyer',
          email: 'ana@example.com',
          phone: '3055550100',
          street: '123 Ocean Dr',
          city: 'Miami',
          zip: '33139',
        },
      }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      clientSecret: 'pi_test_secret',
      orderId: 55,
    });

    expect(mocks.findOrCreateCustomer).toHaveBeenCalledWith({
      name: 'Ana Buyer',
      email: 'ana@example.com',
      phone: '3055550100',
      street: '123 Ocean Dr',
      city: 'Miami',
      zip: '33139',
    });
    expect(mocks.createOrder).toHaveBeenCalledWith(44, [
      {
        product_id: 12,
        product_uom_qty: 2,
        price_unit: 1250,
      },
    ]);
    expect(mocks.getOrderDetails).toHaveBeenCalledWith(55);
    expect(mocks.paymentIntentCreate).toHaveBeenCalledWith(expect.objectContaining({
      amount: 287500,
      currency: 'usd',
      metadata: expect.objectContaining({
        odoo_partner_id: '44',
        odoo_order_id: '55',
        customer_email: 'ana@example.com',
      }),
    }));
  });

  it('rejects cart items without a valid Odoo product id', async () => {
    const { POST } = await import('@/app/api/checkout/stripe/route');

    const response = await POST(new Request('http://localhost/api/checkout/stripe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [
          {
            id: 'fallback-item',
            name: 'Broken Product',
            price: 99,
            quantity: 1,
          },
        ],
        customerData: {
          name: 'Ana Buyer',
          email: 'ana@example.com',
          city: 'Miami',
        },
      }),
    }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Cart item 1 is missing a valid Odoo product ID. Re-open the product from the live catalog and add it again.',
    });
    expect(mocks.createOrder).not.toHaveBeenCalled();
    expect(mocks.paymentIntentCreate).not.toHaveBeenCalled();
  });
});
