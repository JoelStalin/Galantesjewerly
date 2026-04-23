import { NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME, getAdminCookieOptions, signToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || '';

    if (typeof username !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 });
    }

    if (!adminPass) {
      console.error('ADMIN_PASSWORD is not configured.');
      return NextResponse.json({ error: 'Configuracion incompleta del servidor' }, { status: 503 });
    }

    if (username === adminUser && password === adminPass) {
      const token = await signToken({ user: username });

      const response = NextResponse.json({ success: true, user: username });
      response.cookies.set({
        ...getAdminCookieOptions(request),
        name: ADMIN_COOKIE_NAME,
        value: token,
      });

      return response;
    }

    return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
  } catch {
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
