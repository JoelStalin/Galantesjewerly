import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';

const dataDir = process.env.APP_DATA_DIR || path.join(process.cwd(), 'data');
const statusFile = path.join(dataDir, 'inventory-agent', 'evidence', 'whatsapp-session-status.json');
const qrFile = path.join(dataDir, 'inventory-agent', 'evidence', 'whatsapp-live-qr.png');
const sessionActiveFile = path.join(dataDir, 'inventory-agent', 'evidence', 'whatsapp-web-session-active.png');

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view');

    // Return live QR image
    if (view === 'qr') {
      try {
        const imageBuffer = await fs.readFile(qrFile);
        return new NextResponse(imageBuffer, {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'no-store, max-age=0',
          },
        });
      } catch {
        return new NextResponse(null, { status: 404 });
      }
    }

    // Return live session screenshot
    if (view === 'screenshot') {
      try {
        const imageBuffer = await fs.readFile(sessionActiveFile);
        return new NextResponse(imageBuffer, {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'no-store, max-age=0',
          },
        });
      } catch {
        return new NextResponse(null, { status: 404 });
      }
    }

    // Return JSON status
    let sessionData = { ok: true, logged_in: false, status: 'not_started' };
    try {
      const content = await fs.readFile(statusFile, 'utf8');
      sessionData = JSON.parse(content);
    } catch {}

    let qrAvailable = false;
    try {
      await fs.access(qrFile);
      qrAvailable = true;
    } catch {}

    return NextResponse.json({
      ...sessionData,
      qrAvailable,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
