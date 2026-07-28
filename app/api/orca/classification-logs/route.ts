import { NextResponse } from 'next/server';
import { getClassificationLogs, reviewClassificationLog, recordClassificationLog } from '@/lib/orca/classification-feedback';

export async function GET() {
  try {
    const logs = getClassificationLogs();
    return NextResponse.json({ success: true, data: logs });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body.action === 'record') {
      const newLog = recordClassificationLog(body.log);
      return NextResponse.json({ success: true, data: newLog });
    }

    if (body.action === 'review') {
      const updated = reviewClassificationLog(body.id, {
        status: body.status,
        corrected_category: body.corrected_category,
        corrected_tags: body.corrected_tags,
        reviewer_notes: body.reviewer_notes,
      });
      if (!updated) {
        return NextResponse.json({ success: false, error: 'Log not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: updated });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
