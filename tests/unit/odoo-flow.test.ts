import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OdooService } from '@/lib/odoo/services';

// Mock Odoo Client
const mockClient = vi.hoisted(() => ({
  call: vi.fn(),
  create: vi.fn(),
  getConfig: vi.fn(() => ({ enabled: true, isReady: true })),
}));

vi.mock('@/src/config/odooClient', () => ({
  createOdooClient: () => mockClient,
}));

import { createOdooClient } from '@/src/config/odooClient';
createOdooClient();

describe('OdooService - Billing Automation Flow', () => {
  beforeEach(() => {
    (mockClient.call as any).mockReset();
    (mockClient.create as any).mockReset();
    (mockClient.getConfig as any).mockReturnValue({ enabled: true, isReady: true });
  });

  it('should complete the entire flow successfully', async () => {
    (mockClient.call as any)
      .mockResolvedValueOnce([{ state: 'draft', invoice_status: 'to invoice', invoice_ids: [], picking_ids: [] }])
      .mockResolvedValueOnce([{ order_id: 50, invoice_ids: [101], picking_ids: [201] }])
      .mockResolvedValueOnce([{ invoice_ids: [101], picking_ids: [201] }]);

    const result = await OdooService.automateBillingFlow(50, {
      paymentIntentId: 'pi_123',
      chargeId: 'ch_123',
      amount: 250000,
      currency: 'usd',
    });

    expect(result.orderId).toBe(50);
    expect(result.invoiceId).toBe(101);
    expect(result.pickingIds).toEqual([201]);
    expect(result.steps).toContain('finalized');
    expect(mockClient.call).toHaveBeenCalledWith('sale.order', 'action_galantes_finalize_paid_checkout', expect.objectContaining({
      ids: [50],
      stripe_payment: expect.objectContaining({
        payment_intent_id: 'pi_123',
        charge_id: 'ch_123',
        amount: 250000,
        currency: 'usd',
      }),
    }));
  });

  it('passes Stripe payload fields normalized for Odoo synchronization', async () => {
    (mockClient.call as any)
      .mockResolvedValueOnce([{ state: 'sale', invoice_status: 'to invoice', invoice_ids: [], picking_ids: [] }])
      .mockResolvedValueOnce([{ order_id: 60, invoice_ids: [202], picking_ids: [301] }])
      .mockResolvedValueOnce([{ invoice_ids: [202], picking_ids: [301] }]);

    const result = await OdooService.automateBillingFlow(60, {
      paymentIntentId: 'pi_live',
      chargeId: null,
      receiptUrl: 'https://stripe.test/receipt',
      customerEmail: 'ana@example.com',
      paymentStatus: 'succeeded',
    });

    expect(result.invoiceId).toBe(202);
    expect(mockClient.call).toHaveBeenCalledWith('sale.order', 'action_galantes_finalize_paid_checkout', expect.objectContaining({
      ids: [60],
      stripe_payment: expect.objectContaining({
        payment_intent_id: 'pi_live',
        charge_id: false,
        receipt_url: 'https://stripe.test/receipt',
        customer_email: 'ana@example.com',
        payment_status: 'succeeded',
      }),
    }));
  });

  it('should fail and log in Odoo if custom finalization fails', async () => {
    (mockClient.call as any)
      .mockResolvedValueOnce([{ state: 'sale', invoice_status: 'to invoice', invoice_ids: [], picking_ids: [] }])
      .mockRejectedValueOnce(new Error('Out of stock'))
      .mockResolvedValueOnce(true);

    await expect(OdooService.automateBillingFlow(70)).rejects.toThrow('Out of stock');
    
    expect(mockClient.call).toHaveBeenCalledWith('sale.order', 'message_post', expect.any(Object));
  });

  it('should fail if finalization does not link an invoice', async () => {
    (mockClient.call as any)
      .mockResolvedValueOnce([{ state: 'sale', invoice_status: 'to invoice', invoice_ids: [], picking_ids: [] }])
      .mockResolvedValueOnce([{ order_id: 80, invoice_ids: [], picking_ids: [401] }])
      .mockResolvedValueOnce([{ invoice_ids: [], picking_ids: [401] }])
      .mockResolvedValueOnce(true);

    await expect(OdooService.automateBillingFlow(80)).rejects.toThrow(
      'Billing finalization completed without creating or linking an invoice.',
    );
  });

  it('returns invoice and picking ids after Odoo finalization', async () => {
    (mockClient.call as any)
      .mockResolvedValueOnce([{ state: 'sale', invoice_status: 'to invoice', invoice_ids: [], picking_ids: [] }])
      .mockResolvedValueOnce([{ order_id: 81, invoice_ids: [404], picking_ids: [504] }])
      .mockResolvedValueOnce([{ invoice_ids: [404], picking_ids: [504] }]);

    const result = await OdooService.automateBillingFlow(81);

    expect(result.invoiceId).toBe(404);
    expect(result.pickingIds).toEqual([504]);
    expect(result.steps).toContain('finalized');
  });

  it('syncs company contact fields to Odoo without overwriting the legal name', async () => {
    await OdooService.syncCompanyProfile({
      site_title: "Galante's Jewelry",
      contact_email: 'ceo@galantesjewelry.com',
      contact_phone: '+13055550199',
      contact_address: '82681 Overseas Highway, Islamorada, FL 33036, United States',
      instagram_url: 'https://instagram.com/galantesjewelry',
      facebook_url: 'https://facebook.com/galantesjewelry',
      whatsapp_number: '16464965879',
    });

    expect(mockClient.call).toHaveBeenCalledWith('res.country.state', 'search_read', expect.any(Object));
    expect(mockClient.call).toHaveBeenCalledWith('res.company', 'write', expect.objectContaining({
      ids: [1],
      vals: expect.objectContaining({
        email: 'ceo@galantesjewelry.com',
        phone: '+13055550199',
        street: '82681 Overseas Highway',
        city: 'Islamorada',
        zip: '33036',
      }),
    }));

    const companyWriteCall = (mockClient.call as any).mock.calls.find(
      ([model, method]: [string, string]) => model === 'res.company' && method === 'write',
    );
    expect(companyWriteCall?.[2]?.vals?.name).toBeUndefined();
  });

  it('returns a single order with its attached invoices', async () => {
    (mockClient.call as any)
      .mockResolvedValueOnce([{
        id: 55,
        name: 'S00055',
        date_order: '2026-04-23 10:00:00',
        state: 'sale',
        amount_total: 1250,
        invoice_status: 'invoiced',
        access_url: '/my/orders/55',
        partner_id: [44, 'Ana Buyer'],
        invoice_ids: [88],
      }])
      .mockResolvedValueOnce([{
        id: 88,
        name: 'INV/2026/0088',
        invoice_date: '2026-04-23',
        state: 'posted',
        amount_total: 1250,
        payment_state: 'paid',
        access_url: '/my/invoices/88',
        access_token: 'token_88',
      }]);

    const result = await OdooService.getOrderWithInvoices(55);

    expect(result).toEqual(expect.objectContaining({
      id: 55,
      name: 'S00055',
      display_status: 'Completed & Invoiced',
      invoices: [
        expect.objectContaining({
          id: 88,
          name: 'INV/2026/0088',
          display_status: 'Paid',
        }),
      ],
    }));
  });

  it('loads partner orders with invoices after explicit partner ownership validation', async () => {
    (mockClient.call as any)
      .mockResolvedValueOnce([{ email: 'qa.checkout@example.com' }])
      .mockResolvedValueOnce([{
        id: 10,
        name: 'S00010',
        date_order: '2026-04-24 11:20:58',
        state: 'sale',
        amount_total: 454.25,
        invoice_status: 'invoiced',
        access_url: '/my/orders/10',
        invoice_ids: [3],
      }])
      .mockResolvedValueOnce([{
        id: 3,
        name: 'INV/2026/00002',
        invoice_date: '2026-04-24',
        state: 'posted',
        amount_total: 454.25,
        payment_state: 'paid',
        access_url: '/my/invoices/3',
        access_token: 'token_3',
      }]);

    const result = await OdooService.getOrdersWithInvoices(61, 'qa.checkout@example.com');

    expect(mockClient.call).toHaveBeenNthCalledWith(1, 'res.partner', 'search_read', expect.objectContaining({
      domain: [['id', '=', 61]],
      fields: ['email'],
    }));
    expect(mockClient.call).toHaveBeenNthCalledWith(2, 'sale.order', 'search_read', expect.objectContaining({
      domain: [['partner_id', '=', 61]],
      fields: expect.arrayContaining(['id', 'invoice_ids']),
    }));
    expect(mockClient.call).toHaveBeenNthCalledWith(3, 'account.move', 'search_read', expect.objectContaining({
      fields: ['id', 'name', 'invoice_date', 'state', 'amount_total', 'payment_state', 'access_url', 'access_token'],
    }));
    expect(result).toEqual([
      expect.objectContaining({
        id: 10,
        name: 'S00010',
        invoices: [
          expect.objectContaining({
            id: 3,
            name: 'INV/2026/00002',
            display_status: 'Paid',
          }),
        ],
      }),
    ]);
  });
});
