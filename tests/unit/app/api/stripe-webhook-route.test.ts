/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  automateBillingFlow: vi.fn(),
  constructEvent: vi.fn(),
  chargeRetrieve: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: mocks.headers,
}));

vi.mock('@/lib/odoo/services', () => ({
  OdooService: {
    automateBillingFlow: mocks.automateBillingFlow,
  },
}));

vi.mock('stripe', () => {
  class Stripe {
    webhooks = {
      constructEvent: mocks.constructEvent,
    };
    charges = {
      retrieve: mocks.chargeRetrieve,
    };
  }

  return { default: Stripe };
});

describe('POST /api/webhooks/stripe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123');
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test_123');
    mocks.headers.mockResolvedValue(new Headers({ 'stripe-signature': 'sig_test_123' }));
  });

  it('automates the Odoo billing flow when Stripe confirms payment', async () => {
    mocks.constructEvent.mockReturnValue({
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_123',
          status: 'succeeded',
          amount: 125000,
          amount_received: 125000,
          currency: 'usd',
          latest_charge: 'ch_123',
          receipt_email: 'buyer@example.com',
          metadata: {
            odoo_partner_id: '44',
            odoo_order_id: '55',
            customer_email: 'buyer@example.com',
          },
        },
      },
    });
    mocks.chargeRetrieve.mockResolvedValue({ id: 'ch_123', receipt_url: 'https://stripe.test/receipt/ch_123' });
    mocks.automateBillingFlow.mockResolvedValue({
      orderId: 55,
      invoiceId: 88,
      steps: ['confirmed', 'invoiced', 'posted', 'emailed'],
    });

    const { POST } = await import('@/app/api/webhooks/stripe/route');

    const response = await POST(new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      body: '{"id":"evt_test"}',
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true });
    expect(mocks.constructEvent).toHaveBeenCalled();
    expect(mocks.automateBillingFlow).toHaveBeenCalledWith(55, expect.objectContaining({
      paymentIntentId: 'pi_123',
      chargeId: 'ch_123',
      receiptUrl: 'https://stripe.test/receipt/ch_123',
      amount: 125000,
      currency: 'usd',
      customerEmail: 'buyer@example.com',
      paymentStatus: 'succeeded',
    }));
  });

  it('ignores successful payments when webhook metadata lacks valid Odoo ids', async () => {
    mocks.constructEvent.mockReturnValue({
      type: 'payment_intent.succeeded',
      data: {
        object: {
          metadata: {
            odoo_partner_id: 'NaN',
            odoo_order_id: '',
          },
        },
      },
    });

    const { POST } = await import('@/app/api/webhooks/stripe/route');

    const response = await POST(new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      body: '{"id":"evt_test"}',
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true });
    expect(mocks.automateBillingFlow).not.toHaveBeenCalled();
  });
});
