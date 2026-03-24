import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from './lib/auth';

export async function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  const hostname = request.headers.get('host') || '';
  const isAdminSubdomain = hostname.startsWith('admin.galantesjewelry.com');
  const token = request.cookies.get('admin_token')?.value;

  // Determine the effective path to process
  let effectivePath = url.pathname;
  let requiresRewrite = false;

  // Bypass system paths entirely
  if (url.pathname.startsWith('/_next') || url.pathname.startsWith('/assets')) {
    return NextResponse.next();
  }

  // 1. Silent Rewrite for Admin Subdomain
  if (isAdminSubdomain) {
    if (url.pathname === '/') {
      effectivePath = '/admin/dashboard';
      requiresRewrite = true;
    } else if (url.pathname === '/login') {
      effectivePath = '/admin/login';
      requiresRewrite = true;
    } else if (!url.pathname.startsWith('/admin') && !url.pathname.startsWith('/api')) {
      effectivePath = `/admin${url.pathname}`;
      requiresRewrite = true;
    }
  }

  // Security variables computed against the effective path
  const isProtectedAdminRoute = effectivePath.startsWith('/admin') && !effectivePath.startsWith('/admin/login');
  const isLoginRoute = effectivePath.startsWith('/admin/login');
  const isApiRoute = effectivePath.startsWith('/api/admin') && !effectivePath.startsWith('/api/admin/auth');

  // Verify Auth
  let isAuthValid = false;
  if (token) {
    isAuthValid = !!(await verifyToken(token));
  }

  // Shield Content Modification API
  if (isApiRoute && !isAuthValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Shield Dashboard
  if (isProtectedAdminRoute && !isAuthValid) {
    const loginUrl = new URL(isAdminSubdomain ? '/login' : '/admin/login', request.url);
    const response = NextResponse.redirect(loginUrl);
    if (token) response.cookies.delete('admin_token');
    return response;
  }

  // Preempt redundant login
  if (isLoginRoute && isAuthValid) {
    return NextResponse.redirect(new URL(isAdminSubdomain ? '/' : '/admin/dashboard', request.url));
  }

  // Perform invisible routing for standard HTTP requests
  if (requiresRewrite) {
    url.pathname = effectivePath;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|assets|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
