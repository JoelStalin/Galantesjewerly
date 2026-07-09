import { NextResponse } from 'next/server';
import { getGoogleLoginConfig } from '@/lib/google-login';

export async function GET(request: Request) {
  try {
    const config = await getGoogleLoginConfig(request);

    return NextResponse.json(
      {
        enabled: config.enabled,
        environment: config.environment,
        clientId: config.clientId,
        javascriptOrigin: config.javascriptOrigin,
        redirectUri: config.redirectUri,
        scopes: config.scopes,
        startUrl: '/api/auth/google/start',
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch {
    return NextResponse.json({ enabled: false, error: 'Google OAuth is not configured' }, { status: 503 });
  }
}
