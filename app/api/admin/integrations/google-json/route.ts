import { NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth';
import { updateGoogleIntegrationConfig } from '@/lib/integrations';
import type { IntegrationEnvironment } from '@/lib/integration-types';

type GoogleClientJson = {
  client_id?: string;
  client_secret?: string;
  javascript_origins?: string[];
  redirect_uris?: string[];
};

type GoogleImportPayload = {
  environment?: IntegrationEnvironment;
  jsonContent?: string;
};

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

function getGoogleClientJson(raw: string) {
  const parsed = JSON.parse(raw) as {
    web?: GoogleClientJson;
    installed?: GoogleClientJson;
  } & GoogleClientJson;

  return parsed.web || parsed.installed || parsed;
}

export async function POST(request: Request) {
  const { session, response } = await requireAdminSession(request);
  if (response || !session) {
    return response;
  }

  try {
    const payload = await request.json() as GoogleImportPayload;
    const environment = payload.environment || 'production';
    const jsonContent = String(payload.jsonContent || '').trim();

    if (!jsonContent) {
      return NextResponse.json({ error: 'JSON content is required.' }, { status: 400 });
    }

    const credentials = getGoogleClientJson(jsonContent);
    const clientId = String(credentials.client_id || '').trim();
    const clientSecret = String(credentials.client_secret || '').trim();
    const redirectUri = String(credentials.redirect_uris?.[0] || '').trim();
    const javascriptOrigin = String(
      credentials.javascript_origins?.[0]
      || (redirectUri ? new URL(redirectUri).origin : ''),
    ).trim();

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'The uploaded JSON must include client_id and client_secret.' },
        { status: 400 },
      );
    }

    const result = await updateGoogleIntegrationConfig(
      {
        provider: 'google',
        environment,
        enabled: true,
        googleClientId: clientId,
        javascriptOrigin: javascriptOrigin || undefined,
        redirectUri: redirectUri || undefined,
        secrets: {
          googleClientSecret: clientSecret,
        },
      },
      getAuditContext(request, session.user || 'admin'),
    );

    return NextResponse.json({
      success: true,
      clientId,
      config: result.config,
      audit: result.audit,
      changedFields: result.changedFields,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid Google OAuth JSON payload.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
