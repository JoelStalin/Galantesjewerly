import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';

const BROWSER_SERVICE_URL = process.env.WHATSAPP_BROWSER_URL || 'http://galantes_whatsapp_browser:4000';
const dataDir = process.env.APP_DATA_DIR || path.join(process.cwd(), 'data');
const statusFile = path.join(dataDir, 'inventory-agent', 'evidence', 'whatsapp-session-status.json');
const qrFile = path.join(dataDir, 'inventory-agent', 'evidence', 'whatsapp-live-qr.png');
const sessionActiveFile = path.join(dataDir, 'inventory-agent', 'evidence', 'whatsapp-web-session-active.png');

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view');

    // 1. Live Frame Stream
    if (view === 'frame') {
      try {
        const response = await fetch(`${BROWSER_SERVICE_URL}/frame`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(3000),
        });
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          return new NextResponse(buffer, {
            headers: {
              'Content-Type': 'image/jpeg',
              'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
            },
          });
        }
      } catch {
        // Fallback to disk evidence
      }

      try {
        const fallback = await fs.readFile(qrFile);
        return new NextResponse(fallback, {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'no-store, max-age=0',
          },
        });
      } catch {
        return new NextResponse(null, { status: 404 });
      }
    }

    // 2. Return live QR image
    if (view === 'qr') {
      try {
        const response = await fetch(`${BROWSER_SERVICE_URL}/frame`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(3000),
        });
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          return new NextResponse(buffer, {
            headers: {
              'Content-Type': 'image/jpeg',
              'Cache-Control': 'no-store, max-age=0',
            },
          });
        }
      } catch {}

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

    // 3. Return live session screenshot
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

    // 4. Return JSON status (live query from browser service with disk fallback)
    let liveStatus: any = null;
    try {
      const res = await fetch(`${BROWSER_SERVICE_URL}/status`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        liveStatus = await res.json();
      }
    } catch {}

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
      liveBrowser: liveStatus || { ok: false, error: 'unreachable' },
      state: liveStatus?.state || sessionData.status,
      pairingCode: liveStatus?.pairingCode || null,
      hasFrame: liveStatus?.hasFrame || qrAvailable,
      qrAvailable: liveStatus?.hasFrame || qrAvailable,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const response = await fetch(`${BROWSER_SERVICE_URL}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });

    const data = await response.json().catch(() => ({ ok: response.ok }));
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
