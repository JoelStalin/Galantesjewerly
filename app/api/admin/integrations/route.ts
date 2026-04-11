import { NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth';
import {
  getGoogleIntegrationConfigs,
  updateGoogleIntegrationConfig,
} from '@/lib/integrations';

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

export async function GET(request: Request) {
  const { response } = await requireAdminSession(request);
  if (response) {
    return response;
  }

  try {
    return NextResponse.json(await getGoogleIntegrationConfigs());
  } catch {
    return NextResponse.json({ error: 'Failed to read integrations' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const { session, response } = await requireAdminSession(request);
  if (response || !session) {
    return response;
  }

  try {
    const payload = await request.json();
    const result = await updateGoogleIntegrationConfig(
      payload,
      getAuditContext(request, session.user || 'admin'),
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid integration payload';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
