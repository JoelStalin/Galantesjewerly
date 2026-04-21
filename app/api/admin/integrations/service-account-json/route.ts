import { NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth';
import { updateAppointmentIntegrationConfig } from '@/lib/integrations';
import type { IntegrationEnvironment } from '@/lib/integration-types';

type ServiceAccountJson = {
  type?: string;
  client_email?: string;
  private_key?: string;
};

type ServiceAccountImportPayload = {
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

export async function POST(request: Request) {
  const { session, response } = await requireAdminSession(request);
  if (response || !session) {
    return response;
  }

  try {
    const payload = await request.json() as ServiceAccountImportPayload;
    const environment = payload.environment || 'production';
    const jsonContent = String(payload.jsonContent || '').trim();

    if (!jsonContent) {
      return NextResponse.json({ error: 'JSON content is required.' }, { status: 400 });
    }

    const parsed = JSON.parse(jsonContent) as ServiceAccountJson;
    const serviceAccountEmail = String(parsed.client_email || '').trim().toLowerCase();
    const privateKey = String(parsed.private_key || '').trim();

    if (parsed.type !== 'service_account') {
      return NextResponse.json({ error: 'The uploaded JSON is not a Google service account key.' }, { status: 400 });
    }

    if (!serviceAccountEmail || !privateKey) {
      return NextResponse.json(
        { error: 'The uploaded JSON must include client_email and private_key.' },
        { status: 400 },
      );
    }

    const result = await updateAppointmentIntegrationConfig(
      {
        provider: 'appointments',
        environment,
        googleCalendarEnabled: true,
        googleServiceAccountEmail: serviceAccountEmail,
        secrets: {
          googlePrivateKey: privateKey,
        },
      },
      getAuditContext(request, session.user || 'admin'),
    );

    return NextResponse.json({
      success: true,
      serviceAccountEmail,
      config: result.config,
      audit: result.audit,
      changedFields: result.changedFields,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid service account JSON payload.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
