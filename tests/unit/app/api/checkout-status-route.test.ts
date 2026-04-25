/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  paymentIntentRetrieve: vi.fn(),
  chargeRetrieve: vi.fn(),
  automateBillingFlow: vi.fn(),
  getOrderWithInvoices: vi.fn(),
}));

vi.mock('@/lib/odoo/services', () => ({
  OdooService: {
    automateBillingFlow: mocks.automateBillingFlow,
    getOrderWithInvoices: mocks.getOrderWithInvoices,
  },
}));

vi.mock('stripe', () => {
  class Stripe {
    paymentIntents = {
      retrieve: mocks.paymentIntentRetrieve,
    };
    charges = {
      retrieve: mocks.chargeRetrieve,
    };
  }

  return { default: Stripe };
});

describe('GET /api/checkout/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123');
  });

  it('returns the confirmed order and invoice after successful payment', async () => {
    mocks.paymentIntentRetrieve.mockResolvedValue({
      id: 'pi_123',
      status: 'succeeded',
      client_secret: 'pi_secret_123',
      amount: 125000,
      amount_received: 125000,
      currency: 'usd',
      receipt_email: 'buyer@example.com',
      latest_charge: 'ch_123',
      metadata: {
        odoo_order_id: '55',
        customer_email: 'buyer@example.com',
      },
    });
    mocks.chargeRetrieve.mockResolvedValue({ id: 'ch_123', receipt_url: 'https://stripe.test/receipt/ch_123' });
    mocks.automateBillingFlow.mockResolvedValue({ orderId: 55, invoiceId: 88, steps: ['confirmed', 'invoiced', 'posted'] });
    mocks.getOrderWithInvoices.mockResolvedValue({
      id: 55,
      name: 'S00055',
      amount_total: 1250,
      display_status: 'Completed & Invoiced',
      invoices: [{ id: 88, name: 'INV/2026/0088', amount_total: 1250, display_status: 'Posted' }],
    });

    const { GET } = await import('@/app/api/checkout/status/route');
    const response = await GET(new Request('http://localhost/api/checkout/status?payment_intent=pi_123&payment_intent_client_secret=pi_secret_123'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      success: true,
      paymentStatus: 'succeeded',
      customerEmail: 'buyer@example.com',
      invoice: expect.objectContaining({
        id: 88,
        name: 'INV/2026/0088',
      }),
      order: expect.objectContaining({
        id: 55,
        name: 'S00055',
      }),
    }));
    expect(mocks.automateBillingFlow).toHaveBeenCalledWith(55, expect.objectContaining({
      paymentIntentId: 'pi_123',
      chargeId: 'ch_123',
      receiptUrl: 'https://stripe.test/receipt/ch_123',
      amount: 125000,
      currency: 'usd',
      customerEmail: 'buyer@example.com',
      paymentStatus: 'succeeded',
    }));
    expect(mocks.getOrderWithInvoices).toHaveBeenCalledWith(55);
  });

  it('rejects mismatched client secrets', async () => {
    mocks.paymentIntentRetrieve.mockResolvedValue({
      id: 'pi_123',
      status: 'succeeded',
      client_secret: 'pi_secret_actual',
      amount: 125000,
      currency: 'usd',
      metadata: {
        odoo_order_id: '55',
      },
    });

    const { GET } = await import('@/app/api/checkout/status/route');
    const response = await GET(new Request('http://localhost/api/checkout/status?payment_intent=pi_123&payment_intent_client_secret=pi_secret_other'));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid payment intent confirmation.',
    });
    expect(mocks.automateBillingFlow).not.toHaveBeenCalled();
  });
});
