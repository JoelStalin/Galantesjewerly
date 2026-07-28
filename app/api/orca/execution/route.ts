import { NextResponse } from 'next/server';
import { fetchFromOrcaCore } from '@/lib/orca/orca-client';

export async function GET() {
  try {
    const res = await fetchFromOrcaCore('/api/orca/execution/state', { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json({ status: 'offline', error: 'GetUpSoft Main Orca Core Engine unreachable' }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ status: 'offline', error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const res = await fetchFromOrcaCore('/api/orca/execution/control', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to communicate with GetUpSoft Main Orca Core Engine' }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
