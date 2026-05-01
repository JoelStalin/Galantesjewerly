/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  headers: vi.fn(),
  getAuthenticatedCustomerFromCookies: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

vi.mock('next/headers', () => ({
  cookies: mocks.cookies,
  headers: mocks.headers,
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}));

vi.mock('@/lib/customer-auth', () => ({
  getAuthenticatedCustomerFromCookies: mocks.getAuthenticatedCustomerFromCookies,
}));

describe('account layout', () => {
  it('redirects unauthenticated visitors to login with the current account path', async () => {
    mocks.cookies.mockResolvedValue({} as never);
    mocks.headers.mockResolvedValue({
      get: (name: string) => (name === 'x-current-url' ? '/account/orders' : null),
    } as never);
    mocks.getAuthenticatedCustomerFromCookies.mockResolvedValue(null);

    const { default: AccountLayout } = await import('@/app/account/layout');

    await expect(AccountLayout({ children: 'child' as never })).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.redirect).toHaveBeenCalledWith('/auth/login?returnTo=%2Faccount%2Forders');
  });
});
