import { NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth';
import { listAppointmentRecords, type OdooSyncStatus } from '@/lib/appointments';

const ODOO_SYNC_STATUSES = new Set<OdooSyncStatus>(['not_attempted', 'synced', 'failed', 'skipped']);

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
    const requestedOdooSyncStatus = url.searchParams.get('odooSyncStatus')?.trim() || '';
    const odooSyncStatus = ODOO_SYNC_STATUSES.has(requestedOdooSyncStatus as OdooSyncStatus)
      ? requestedOdooSyncStatus as OdooSyncStatus
      : undefined;
    const records = await listAppointmentRecords({ limit, odooSyncStatus });

    return NextResponse.json({
      records,
      totalReturned: records.length,
      appliedFilters: {
        odooSyncStatus: odooSyncStatus || 'all',
      },
    }, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to read appointments' }, { status: 500 });
  }
}
