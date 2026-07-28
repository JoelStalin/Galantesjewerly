import { NextResponse } from 'next/server';

const ORCA_UI_PORT = process.env.ORCA_UI_PORT || 4173;
const ORCA_BASE_URL = `http://127.0.0.1:${ORCA_UI_PORT}`;

export async function GET() {
  try {
    const res = await fetch(`${ORCA_BASE_URL}/api/orca/execution/state`, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json({ status: 'offline', error: 'Orca adapter unreachable' }, { status: 502 });
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
    const res = await fetch(`${ORCA_BASE_URL}/api/orca/execution/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to communicate with Orca debug engine' }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
