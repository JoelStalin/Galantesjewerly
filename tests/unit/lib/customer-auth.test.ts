/**
 * @vitest-environment node
 */
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('customer auth', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('hashes passwords and authenticates by username or email', async () => {
    vi.doUnmock('node:fs/promises');
    const dataDir = path.join(os.tmpdir(), `galantes-customer-auth-${Date.now()}`);
    vi.stubEnv('APP_DATA_DIR', dataDir);
    vi.stubEnv('CUSTOMER_SESSION_SECRET', 'test_customer_session_secret');

    const auth = await import('@/lib/customer-auth');

    const hash = auth.hashCustomerPassword('Password123!');
    expect(auth.verifyCustomerPassword('Password123!', hash)).toBe(true);
    expect(auth.verifyCustomerPassword('wrong-password', hash)).toBe(false);

    await auth.registerCustomerAccount({
      username: 'joel',
      name: 'Joel Test',
      email: 'joel@example.com',
      password: 'Password123!',
    });

    const byUsername = await auth.authenticateCustomerAccount('joel', 'Password123!');
    expect(byUsername.email).toBe('joel@example.com');

    const byEmail = await auth.authenticateCustomerAccount('joel@example.com', 'Password123!');
    expect(byEmail.username).toBe('joel');
  });
});

