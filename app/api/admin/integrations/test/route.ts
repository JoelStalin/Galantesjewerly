import { NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth';
import {
  getGoogleIntegrationForEnvironment,
  recordAppointmentIntegrationTest,
  recordGoogleIntegrationTest,
} from '@/lib/integrations';
import type { IntegrationEnvironment } from '@/lib/integration-types';
import { testCalendarConnection } from '@/lib/google-calendar';
import { testMailConnection } from '@/lib/mailer';

function getAuditContext(request: Request, actor: string) {
  const forwardedFor = request.headers.get('x-forwarded-for') || '';
  const ipAddress = forwardedFor.split(',')[0]?.trim() || 'local';

  return {
    actor,
    ipAddress,
    userAgent: request.headers.get('user-agent') || 'unknown',
  };
}

async function requireAdminSession(request: Request) {
  const session = await getAdminSessionFromRequest(request);

  if (!session) {
    return {
      session: null,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { session, response: null };
}

export async function POST(request: Request) {
  const { session, response } = await requireAdminSession(request);
  if (response || !session) {
    return response;
  }

  try {
    const { environment, provider } = await request.json() as {
      environment?: IntegrationEnvironment;
      provider?: 'google' | 'appointments';
    };
    const resolvedEnvironment = environment || 'production';

    if (provider === 'appointments') {
      const [calendarResult, mailResult] = await Promise.all([
        testCalendarConnection(resolvedEnvironment),
        testMailConnection(resolvedEnvironment),
      ]);
      await recordAppointmentIntegrationTest(
        resolvedEnvironment,
        getAuditContext(request, session.user || 'admin'),
      );

      return NextResponse.json({
        ok: true,
        provider: 'appointments',
        calendar: calendarResult,
        mail: mailResult,
      });
    }

    const config = await getGoogleIntegrationForEnvironment(resolvedEnvironment);

    const missingFields = [
      !config.googleClientId ? 'googleClientId' : '',
      !config.redirectUri ? 'redirectUri' : '',
      !config.javascriptOrigin ? 'javascriptOrigin' : '',
      !config.encryptedSecrets.googleClientSecret ? 'googleClientSecret' : '',
    ].filter(Boolean);

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `Missing required fields: ${missingFields.join(', ')}`,
        },
        { status: 400 },
      );
    }

    const discoveryResponse = await fetch('https://accounts.google.com/.well-known/openid-configuration', {
      cache: 'no-store',
    });

    if (!discoveryResponse.ok) {
      throw new Error('Google OpenID discovery endpoint did not respond successfully.');
    }

    const discovery = await discoveryResponse.json();
    await recordGoogleIntegrationTest(
      resolvedEnvironment,
      getAuditContext(request, session.user || 'admin'),
    );

    return NextResponse.json({
      ok: true,
      issuer: discovery.issuer || 'https://accounts.google.com',
      authEndpoint: discovery.authorization_endpoint || 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: discovery.token_endpoint || 'https://oauth2.googleapis.com/token',
      redirectUri: config.redirectUri,
      scopes: config.scopes,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not test Google integration';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
