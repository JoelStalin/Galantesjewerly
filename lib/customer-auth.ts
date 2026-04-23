import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { SignJWT, jwtVerify } from 'jose';
import { getDataRoot } from '@/lib/runtime-paths';
import { shouldUseSecureCookies } from '@/lib/auth';
import { GOOGLE_USER_COOKIE, verifyGoogleUserSession } from '@/lib/google-login';

export const CUSTOMER_SESSION_COOKIE = 'customer_session';
export const CUSTOMER_SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export type CustomerSessionPayload = {
  sub: string;
  email: string;
  name?: string;
  username?: string;
  authMethod: 'google' | 'password';
  exp?: number;
  iat?: number;
};

export type AuthenticatedCustomer = {
  email: string;
  name?: string;
  username?: string;
  authMethod: 'google' | 'password';
};

type CookieSource = {
  get(name: string): { value: string } | undefined;
};

type RequestLike = {
  headers: Headers;
};

type CustomerAccountRecord = {
  username: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
};

type CustomerAuthStore = {
  customers: CustomerAccountRecord[];
};

const customerAuthFile = path.join(getDataRoot(), 'customer-auth.json');
const CUSTOMER_SESSION_FALLBACK_SECRET = crypto.randomBytes(32).toString('hex');

function normalizeValue(value: string) {
  return value.trim().toLowerCase();
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function getCustomerSessionKey() {
  return new TextEncoder().encode(
    process.env.CUSTOMER_SESSION_SECRET ||
      process.env.GOOGLE_SESSION_SECRET ||
      process.env.ADMIN_SECRET_KEY ||
      CUSTOMER_SESSION_FALLBACK_SECRET,
  );
}

function getPasswordSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function hashPassword(password: string, salt = getPasswordSalt()) {
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}

function verifyPassword(password: string, storedHash: string) {
  const [salt, digest] = storedHash.split(':');
  if (!salt || !digest) {
    return false;
  }

  const computed = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(digest, 'hex'));
}

function emptyStore(): CustomerAuthStore {
  return { customers: [] };
}

async function readStore(): Promise<CustomerAuthStore> {
  try {
    const content = await fs.readFile(customerAuthFile, 'utf8');
    const parsed = JSON.parse(content) as Partial<CustomerAuthStore>;
    return { customers: Array.isArray(parsed.customers) ? parsed.customers : [] };
  } catch {
    return emptyStore();
  }
}

async function writeStore(store: CustomerAuthStore) {
  await fs.mkdir(path.dirname(customerAuthFile), { recursive: true });
  await fs.writeFile(customerAuthFile, JSON.stringify(store, null, 2), 'utf8');
}

function toAuthenticatedCustomer(record: CustomerAccountRecord): AuthenticatedCustomer {
  return {
    authMethod: 'password',
    email: record.email,
    name: record.name,
    username: record.username,
  };
}

function toSessionPayload(customer: AuthenticatedCustomer): CustomerSessionPayload {
  return {
    sub: customer.email,
    email: customer.email,
    name: customer.name,
    username: customer.username,
    authMethod: customer.authMethod,
  };
}

export function sanitizeCustomerIdentifier(value: string) {
  return normalizeValue(value);
}

export function validateCustomerPassword(password: string) {
  return password.trim().length >= 8;
}

export function hashCustomerPassword(password: string) {
  return hashPassword(password);
}

export function verifyCustomerPassword(password: string, storedHash: string) {
  return verifyPassword(password, storedHash);
}

export async function registerCustomerAccount(input: {
  username: string;
  name: string;
  email: string;
  password: string;
}) {
  const username = normalizeValue(input.username);
  const email = normalizeValue(input.email);
  const name = normalizeName(input.name);

  if (!username || !email || !name) {
    throw new Error('Username, name, and email are required.');
  }

  if (!validateCustomerPassword(input.password)) {
    throw new Error('Password must be at least 8 characters long.');
  }

  const store = await readStore();
  const now = new Date().toISOString();
  const existingByUsername = store.customers.find((customer) => normalizeValue(customer.username) === username);
  const existingByEmail = store.customers.find((customer) => normalizeValue(customer.email) === email);

  if (existingByUsername && existingByEmail && existingByUsername !== existingByEmail) {
    throw new Error('Username and email already belong to different accounts.');
  }

  const existing = existingByUsername || existingByEmail;

  if (existing) {
    if (existingByUsername && normalizeValue(existing.email) !== email) {
      throw new Error('That username is already in use.');
    }

    if (existingByEmail && existingByUsername && existingByEmail.username && normalizeValue(existingByEmail.username) !== username) {
      throw new Error('That email is already linked to a different username.');
    }

    existing.username = username || existing.username;
    existing.email = email;
    existing.name = name;
    existing.passwordHash = hashCustomerPassword(input.password);
    existing.updatedAt = now;
    existing.lastLoginAt = now;

    await writeStore(store);
    return toAuthenticatedCustomer(existing);
  }

  const record: CustomerAccountRecord = {
    username,
    name,
    email,
    passwordHash: hashCustomerPassword(input.password),
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
  };

  store.customers.unshift(record);
  await writeStore(store);
  return toAuthenticatedCustomer(record);
}

export async function authenticateCustomerAccount(identifier: string, password: string) {
  const normalizedIdentifier = normalizeValue(identifier);
  if (!normalizedIdentifier) {
    throw new Error('Username or email is required.');
  }

  if (!password) {
    throw new Error('Password is required.');
  }

  const store = await readStore();
  const customer = store.customers.find(
    (record) =>
      normalizeValue(record.username) === normalizedIdentifier ||
      normalizeValue(record.email) === normalizedIdentifier,
  );

  if (!customer || !verifyPassword(password, customer.passwordHash)) {
    throw new Error('Invalid username/email or password.');
  }

  customer.lastLoginAt = new Date().toISOString();
  customer.updatedAt = customer.lastLoginAt;
  await writeStore(store);

  return toAuthenticatedCustomer(customer);
}

export async function signCustomerSession(customer: AuthenticatedCustomer) {
  return await new SignJWT(toSessionPayload(customer))
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getCustomerSessionKey());
}

export async function verifyCustomerSession(token: string): Promise<AuthenticatedCustomer | null> {
  try {
    const { payload } = await jwtVerify(token, getCustomerSessionKey());
    const session = payload as CustomerSessionPayload;

    if (!session.email || !session.authMethod) {
      return null;
    }

    return {
      authMethod: session.authMethod,
      email: session.email,
      name: session.name,
      username: session.username,
    };
  } catch {
    return null;
  }
}

export function getCustomerSessionCookieOptions(request: RequestLike) {
  return {
    httpOnly: true,
    maxAge: CUSTOMER_SESSION_MAX_AGE,
    path: '/',
    sameSite: 'lax' as const,
    secure: shouldUseSecureCookies(request),
  };
}

export function getExpiredCustomerSessionCookieOptions(request: RequestLike) {
  return {
    ...getCustomerSessionCookieOptions(request),
    expires: new Date(0),
    maxAge: 0,
  };
}

export async function getAuthenticatedCustomerFromCookies(cookieSource: CookieSource) {
  const customerToken = cookieSource.get(CUSTOMER_SESSION_COOKIE)?.value;
  if (customerToken) {
    const localSession = await verifyCustomerSession(customerToken);
    if (localSession) {
      return localSession;
    }
  }

  const googleToken = cookieSource.get(GOOGLE_USER_COOKIE)?.value;
  if (googleToken) {
    const googleSession = await verifyGoogleUserSession(googleToken);
    if (googleSession) {
      return {
        authMethod: 'google' as const,
        email: googleSession.email,
        name: googleSession.name,
      };
    }
  }

  return null;
}

export async function getAuthenticatedCustomerFromRequest(request: Request) {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) {
    return null;
  }

  const cookieMap = new Map(
    cookieHeader.split(';').map((chunk) => {
      const [name, ...rest] = chunk.trim().split('=');
      return [name, rest.join('=')];
    }),
  );

  return getAuthenticatedCustomerFromCookies({
    get(name: string) {
      const value = cookieMap.get(name);
      return value ? { value } : undefined;
    },
  });
}

export async function getCustomerAccountByEmail(email: string) {
  const store = await readStore();
  return store.customers.find((customer) => normalizeValue(customer.email) === normalizeValue(email)) || null;
}

