import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME, verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const session = await verifyToken(token);

  if (!session) {
    return NextResponse.json({ error: 'Sesión inválida o expirada' }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    expiresAt: session.exp ? new Date(session.exp * 1000).toISOString() : null,
    user: session.user,
  });
}
