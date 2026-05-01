/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  getAuthenticatedCustomerFromCookies: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

vi.mock('next/headers', () => ({
  cookies: mocks.cookies,
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}));

vi.mock('@/lib/customer-auth', () => ({
  getAuthenticatedCustomerFromCookies: mocks.getAuthenticatedCustomerFromCookies,
}));

vi.mock('@/lib/odoo/services', () => ({
  OdooService: {
    getPartnerByEmail: vi.fn(),
    findOrCreateCustomer: vi.fn(),
    getOrdersWithInvoices: vi.fn(),
    getPartnerInvoices: vi.fn(),
    getOrderFullDetails: vi.fn(),
  },
}));

describe('account pages', () => {
  it('redirects unauthenticated users from orders', async () => {
    mocks.cookies.mockResolvedValue({} as never);
    mocks.getAuthenticatedCustomerFromCookies.mockResolvedValue(null);

    const { default: OrdersPage } = await import('@/app/account/orders/page');

    await expect(OrdersPage()).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.redirect).toHaveBeenCalledWith('/auth/login?returnTo=/account/orders');
  });

  it('redirects unauthenticated users from invoices', async () => {
    mocks.cookies.mockResolvedValue({} as never);
    mocks.getAuthenticatedCustomerFromCookies.mockResolvedValue(null);

    const { default: InvoicesPage } = await import('@/app/account/invoices/page');

    await expect(InvoicesPage()).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.redirect).toHaveBeenCalledWith('/auth/login?returnTo=/account/invoices');
  });

  it('redirects unauthenticated users from addresses', async () => {
    mocks.cookies.mockResolvedValue({} as never);
    mocks.getAuthenticatedCustomerFromCookies.mockResolvedValue(null);

    const { default: AddressesPage } = await import('@/app/account/addresses/page');

    await expect(AddressesPage()).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.redirect).toHaveBeenCalledWith('/auth/login?returnTo=/account/addresses');
  });

  it('redirects unauthenticated users from order detail', async () => {
    mocks.cookies.mockResolvedValue({} as never);
    mocks.getAuthenticatedCustomerFromCookies.mockResolvedValue(null);

    const { default: OrderDetailPage } = await import('@/app/account/orders/[id]/page');

    await expect(OrderDetailPage({ params: Promise.resolve({ id: '123' }) } as never)).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.redirect).toHaveBeenCalledWith('/auth/login?returnTo=/account/orders/123');
  });
});
