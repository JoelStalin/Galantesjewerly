/**
 * @vitest-environment node
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
 import { getGoogleLoginConfig, getGoogleRedirectBaseUrl, getPublicUrl, getRequestUrl } from '@/lib/google-login';

vi.mock('@/lib/integrations', () => ({
  getDecryptedGoogleIntegration: vi.fn(async () => ({
    enabled: true,
    googleClientId: '',
    redirectUri: '',
    javascriptOrigin: '',
    scopes: [],
    secrets: {
      googleClientSecret: '',
    },
  })),
}));
import { getAdminGoogleOAuthRedirectUri } from '@/lib/google-oauth';

describe('google-login canonical public URLs', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('prefers SITE_URL over the incoming request host', () => {
    vi.stubEnv('GOOGLE_PUBLIC_BASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
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
    vi.stubEnv('GOOGLE_PUBLIC_BASE_URL', '');
    vi.stubEnv('SITE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
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

  it('normalizes 0.0.0.0 in configured site URLs', () => {
    vi.stubEnv('GOOGLE_PUBLIC_BASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    vi.stubEnv('SITE_URL', 'http://0.0.0.0:3000');

    const request = {
      headers: new Headers(),
      url: 'http://0.0.0.0:3000/auth/google/callback?code=test',
    };

    expect(getPublicUrl('/?google_login=error', request)).toBe('http://localhost:3000/?google_login=error');
  });

  it('uses the Google redirect URI origin when available', () => {
    const request = { headers: new Headers({ host: 'localhost:3000' }),
      url: 'http://localhost:3000/auth/google/callback?code=test',
    };

    expect(
      getGoogleRedirectBaseUrl('https://galantesjewelry.com.do/auth/google/callback', request),
    ).toBe('https://galantesjewelry.com.do');
  });

  it('builds admin URLs from the current request host instead of SITE_URL', () => {
    vi.stubEnv('SITE_URL', 'https://galantesjewelry.com');

    const request = {
      headers: new Headers({
        host: 'admin.galantesjewelry.com',
        'x-forwarded-host': 'admin.galantesjewelry.com',
        'x-forwarded-proto': 'https',
      }),
      url: 'https://admin.galantesjewelry.com/api/admin/google/oauth/start?environment=production',
    };

    expect(getRequestUrl('/admin/login', request)).toBe('https://admin.galantesjewelry.com/admin/login');
  });

  it('uses the admin host for the admin Google OAuth callback', () => {
    vi.stubEnv('SITE_URL', 'https://galantesjewelry.com');

    const request = new Request('https://admin.galantesjewelry.com/api/admin/google/oauth/start?environment=production', {
      headers: {
        host: 'admin.galantesjewelry.com',
        'x-forwarded-host': 'admin.galantesjewelry.com',
        'x-forwarded-proto': 'https',
      },
    });

    expect(getAdminGoogleOAuthRedirectUri(request)).toBe('https://admin.galantesjewelry.com/api/admin/google/oauth/callback');
  });

  it('normalizes request.url loopback origins when host headers are absent', () => {
    const request = {
      headers: new Headers(),
      url: 'http://0.0.0.0:3000/api/admin/google/oauth/start?environment=development',
    };

    expect(getRequestUrl('/admin/login', request)).toBe('http://localhost:3000/admin/login');
  });

  it('derives the customer Google callback URL from the current request when no env override exists', async () => {
    vi.stubEnv('GOOGLE_OAUTH_REDIRECT_URI', '');
    vi.stubEnv('REDIRECT_URI', '');
    vi.stubEnv('GOOGLE_OAUTH_JAVASCRIPT_ORIGIN', '');
    vi.stubEnv('GOOGLE_PUBLIC_BASE_URL', '');
    vi.stubEnv('SITE_URL', 'https://galantesjewelry.com');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');

    const request = {
      headers: new Headers({
        host: 'galantesjewelry.com',
        'x-forwarded-host': 'galantesjewelry.com',
        'x-forwarded-proto': 'https',
      }),
      url: 'https://galantesjewelry.com/api/auth/google/start?returnTo=%2Faccount%2Forders',
    };

    const config = await getGoogleLoginConfig(request);

    expect(config.redirectUri).toBe('https://galantesjewelry.com/auth/google/callback');
    expect(config.javascriptOrigin).toBe('https://galantesjewelry.com');
  });
});
