import { NextResponse } from 'next/server';
import { signToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    
    // Default fallback creds if missing from .env
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'galantes2026';
    
    if (username === adminUser && password === adminPass) {
      const token = await signToken({ user: username });
      
      const response = NextResponse.json({ success: true });
      response.cookies.set({
        name: 'admin_token',
        value: token,
        httpOnly: true,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 // 24 hours
      });
      return response;
    }
    
    return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
  } catch (error) {
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
