import { afterEach, describe, expect, it, vi } from 'vitest';
import { getGoogleRedirectBaseUrl, getPublicUrl } from '@/lib/google-login';

describe('google-login canonical public URLs', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('prefers SITE_URL over the incoming request host', () => {
    vi.stubEnv('SITE_URL', 'https://galantesjewelry.com.do');

    const request = {
      headers: new Headers({
        host: '0.0.0.0:3000',
        'x-forwarded-host': '0.0.0.0:3000',
        'x-forwarded-proto': 'http',
      }),
      url: 'http://0.0.0.0:3000/auth/google/callback?code=test',
    };

    expect(getPublicUrl('/?google_login=error', request)).toBe('https://galantesjewelry.com.do/?google_login=error');
  });

  it('falls back to localhost when no canonical site URL is configured', () => {
    const request = {
      headers: new Headers({
        host: '0.0.0.0:3000',
        'x-forwarded-host': '0.0.0.0:3000',
        'x-forwarded-proto': 'http',
      }),
      url: 'http://0.0.0.0:3000/auth/google/callback?code=test',
    };

    expect(getPublicUrl('/?google_login=error', request)).toBe('http://localhost:3000/?google_login=error');
  });

  it('uses the Google redirect URI origin when available', () => {
    const request = {
      headers: new Headers({ host: 'localhost:3000' }),
      url: 'http://localhost:3000/auth/google/callback?code=test',
    };

    expect(
      getGoogleRedirectBaseUrl('https://galantesjewelry.com.do/auth/google/callback', request),
    ).toBe('https://galantesjewelry.com.do');
  });
});
