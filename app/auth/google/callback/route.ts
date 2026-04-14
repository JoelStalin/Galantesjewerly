import { GET as handleAdminGoogleOAuthCallback } from '@/app/api/admin/google/oauth/callback/route';
import { GET as handlePublicGoogleLoginCallback } from '@/app/api/auth/google/callback/route';

export const runtime = 'nodejs';

function hasCookie(cookieHeader: string | null, cookieName: string) {
  if (!cookieHeader) {
    return false;
  }

  return cookieHeader
    .split(';')
    .some((cookie) => cookie.trim().startsWith(`${cookieName}=`));
}

export async function GET(request: Request) {
  const cookieHeader = request.headers.get('cookie');

  if (hasCookie(cookieHeader, 'admin_google_connect_state')) {
    return handleAdminGoogleOAuthCallback(request);
  }

  return handlePublicGoogleLoginCallback(request);
}
