import { NextResponse } from 'next/server';
import { fetchFromOrcaCore } from '@/lib/orca/orca-client';
import { getClassificationLogs, reviewClassificationLog, recordClassificationLog } from '@/lib/orca/classification-feedback';

export async function GET() {
  try {
    // Attempt fetching from central Orca Core engine first
    const res = await fetchFromOrcaCore('/api/orca/classification-logs', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({ success: true, source: 'orca-core', data: data.data || [] });
    }
  } catch (e) {
    // Fallback to local tenant store if central engine is offline
  }

  try {
    const logs = getClassificationLogs('galantesjewelry');
    return NextResponse.json({ success: true, source: 'local-store', data: logs });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Attempt forwarding review/record to main Orca Core engine first
    try {
      const endpoint = body.action === 'review' ? '/api/orca/classification-logs/review' : '/api/orca/classification-logs';
      const res = await fetchFromOrcaCore(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({ success: true, source: 'orca-core', data });
      }
    } catch (e) {
      // Fallback to local store
    }

    if (body.action === 'record') {
      const newLog = recordClassificationLog(body.log, 'galantesjewelry');
      return NextResponse.json({ success: true, source: 'local-store', data: newLog });
    }

    if (body.action === 'review') {
      const updated = reviewClassificationLog(body.id, {
        status: body.status,
        corrected_category: body.corrected_category,
        corrected_tags: body.corrected_tags,
        reviewer_notes: body.reviewer_notes,
      }, 'galantesjewelry');

      if (!updated) {
        return NextResponse.json({ success: false, error: 'Log not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, source: 'local-store', data: updated });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
