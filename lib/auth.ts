import { SignJWT, jwtVerify } from 'jose';

export const ADMIN_COOKIE_NAME = 'admin_token';
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export type AdminSessionPayload = {
  user: string;
  exp?: number;
  iat?: number;
};

type RequestLike = {
  headers: Headers;
};

function readCookieValue(cookieHeader: string | null, cookieName: string) {
  if (!cookieHeader) {
    return null;
  }

  for (const chunk of cookieHeader.split(';')) {
    const [rawName, ...rest] = chunk.trim().split('=');
    if (rawName === cookieName) {
      return rest.join('=') || null;
    }
  }

  return null;
}

function getSecretKey() {
  return new TextEncoder().encode(process.env.ADMIN_SECRET_KEY || 'default_secret_for_local_testing_only_galantes');
}

export function shouldUseSecureCookies(request?: RequestLike) {
  const forwardedProto = request?.headers.get('x-forwarded-proto');

  if (forwardedProto) {
    return forwardedProto.split(',')[0]?.trim() === 'https';
  }

  return process.env.NODE_ENV === 'production';
}

export function getAdminCookieOptions(request?: RequestLike) {
  return {
    httpOnly: true,
    maxAge: ADMIN_SESSION_MAX_AGE,
    path: '/',
    sameSite: 'lax' as const,
    secure: shouldUseSecureCookies(request),
  };
}

export function getExpiredAdminCookieOptions(request?: RequestLike) {
  return {
    ...getAdminCookieOptions(request),
    expires: new Date(0),
    maxAge: 0,
  };
}

export async function signToken(payload: Pick<AdminSessionPayload, 'user'>) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getSecretKey());
}

export async function verifyToken(token: string): Promise<AdminSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as AdminSessionPayload;
  } catch {
    return null;
  }
}

export async function getAdminSessionFromRequest(request: RequestLike) {
  const token = readCookieValue(request.headers.get('cookie'), ADMIN_COOKIE_NAME);

  if (!token) {
    return null;
  }

  return verifyToken(token);
}
