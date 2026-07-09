import { NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME, getExpiredAdminCookieOptions } from '@/lib/auth';

export async function POST(request: Request) {
  const response = NextResponse.json({ success: true });

  response.cookies.set({
    ...getExpiredAdminCookieOptions(request),
    name: ADMIN_COOKIE_NAME,
    value: '',
  });

  return response;
}
