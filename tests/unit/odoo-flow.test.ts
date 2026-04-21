import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OdooService } from '@/lib/odoo/services';

// Mock Odoo Client
const mockClient = vi.hoisted(() => ({
  call: vi.fn(),
  create: vi.fn(),
}));

vi.mock('@/src/config/odooClient', () => ({
  createOdooClient: () => mockClient,
}));

import { createOdooClient } from '@/src/config/odooClient';
createOdooClient();

describe('OdooService - Billing Automation Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should complete the entire flow successfully', async () => {
    // 1. Mock confirmation success
    (mockClient.call as any).mockResolvedValueOnce(true); 
    // 2. Mock invoice creation returning ID 101
    (mockClient.call as any).mockResolvedValueOnce([101]); 
    // 3. Mock invoice posting success
    (mockClient.call as any).mockResolvedValueOnce(true); 
    // 4. Mock email sending success
    (mockClient.call as any).mockResolvedValueOnce(true); 

    const result = await OdooService.automateBillingFlow(50);

    expect(result.orderId).toBe(50);
    expect(result.invoiceId).toBe(101);
    expect(result.steps).toContain('emailed');
    expect(mockClient.call).toHaveBeenCalledTimes(4);
  });

  it('should handle email failure but return success for billing', async () => {
    // 1. Confirm
    (mockClient.call as any).mockResolvedValueOnce(true); 
    // 2. Invoice
    (mockClient.call as any).mockResolvedValueOnce([202]); 
    // 3. Post
    (mockClient.call as any).mockResolvedValueOnce(true); 
    // 4. Email FAIL
    (mockClient.call as any).mockRejectedValueOnce(new Error('SMTP Timeout')); 

    const result = await OdooService.automateBillingFlow(60);

    expect(result.invoiceId).toBe(202);
    expect(result.steps).not.toContain('emailed');
    expect(result.steps).toContain('posted');
  });

  it('should fail and log in Odoo if invoice creation fails', async () => {
    // 1. Confirm
    (mockClient.call as any).mockResolvedValueOnce(true); 
    // 2. Invoice FAIL
    (mockClient.call as any).mockRejectedValueOnce(new Error('Out of stock')); 
    // 3. Mock message_post (logging error)
    (mockClient.call as any).mockResolvedValueOnce(true);

    await expect(OdooService.automateBillingFlow(70)).rejects.toThrow('Out of stock');
    
    // Should have called confirm, then invoice, then message_post
    expect(mockClient.call).toHaveBeenCalledWith('sale.order', 'message_post', expect.any(Object));
  });
});
