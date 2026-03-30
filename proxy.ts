import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ADMIN_COOKIE_NAME, getExpiredAdminCookieOptions, verifyToken } from '@/lib/auth';

export default async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  let { pathname } = url;
  const hostname = request.headers.get('host') || '';
  const isAdminSubdomain = hostname.startsWith('admin.galantesjewelry.com');
  let shouldRewrite = false;

  // Logic for Subdomain Rewriting (Legacy from proxy.ts)
  if (isAdminSubdomain) {
    if (pathname === '/') {
      url.pathname = '/admin/dashboard';
      pathname = url.pathname;
      shouldRewrite = true;
    } else if (pathname === '/login') {
      url.pathname = '/admin/login';
      pathname = url.pathname;
      shouldRewrite = true;
    } else if (!pathname.startsWith('/admin') && !pathname.startsWith('/api')) {
      url.pathname = `/admin${pathname}`;
      pathname = url.pathname;
      shouldRewrite = true;
    }
  }

  // Protection Logic
  const isAdminLoginRoute = pathname === '/admin/login';
  const isProtectedAdminRoute = pathname.startsWith('/admin') && !isAdminLoginRoute;
  const isProtectedApiRoute = pathname.startsWith('/api/admin') && !pathname.startsWith('/api/admin/auth');
  const shouldCheckSession = isAdminSubdomain || pathname.startsWith('/admin') || pathname.startsWith('/api/admin');
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const session = shouldCheckSession && token ? await verifyToken(token) : null;
  const hasInvalidSession = Boolean(token) && !session;

  if (isAdminLoginRoute && session) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }

  if (isProtectedAdminRoute || isProtectedApiRoute) {
    if (hasInvalidSession) {
      const response = isProtectedApiRoute
        ? NextResponse.json({ error: 'Sesión inválida o expirada' }, { status: 401 })
        : NextResponse.redirect(new URL('/admin/login', request.url));

      response.cookies.set({
        ...getExpiredAdminCookieOptions(request),
        name: ADMIN_COOKIE_NAME,
        value: '',
      });

      return response;
    }

    if (!session) {
      if (isProtectedApiRoute) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  if (shouldRewrite) {
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
