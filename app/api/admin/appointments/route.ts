import { NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth';
import { listAppointmentRecords } from '@/lib/appointments';

async function requireAdminSession(request: Request) {
  const session = await getAdminSessionFromRequest(request);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

export async function GET(request: Request) {
  const unauthorizedResponse = await requireAdminSession(request);
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const url = new URL(request.url);
    const requestedLimit = Number(url.searchParams.get('limit') || 100);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(Math.round(requestedLimit), 250))
      : 100;
    const records = await listAppointmentRecords(limit);

    return NextResponse.json({
      records,
      totalReturned: records.length,
    }, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to read appointments' }, { status: 500 });
  }
}
