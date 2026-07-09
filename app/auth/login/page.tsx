'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type AuthMode = 'login' | 'register';
type GoogleConfigState = {
  enabled: boolean;
  startUrl?: string;
};

function sanitizeReturnTo(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/account/orders';
  }

  return value;
}

export default function CustomerLoginPage() {
  const searchParams = useSearchParams();
  const returnTo = useMemo(() => sanitizeReturnTo(searchParams.get('returnTo')), [searchParams]);
  const [mode, setMode] = useState<AuthMode>('login');
  const [googleConfig, setGoogleConfig] = useState<GoogleConfigState>({ enabled: false });
  const [loadingGoogleConfig, setLoadingGoogleConfig] = useState(true);
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadGoogleConfig() {
      try {
        const response = await fetch('/api/auth/google/config', { cache: 'no-store' });
        const data = await response.json().catch(() => ({}));
        if (!active) {
          return;
        }

        setGoogleConfig({
          enabled: Boolean(response.ok && data.enabled),
          startUrl: typeof data.startUrl === 'string' ? data.startUrl : '/api/auth/google/start',
        });
      } catch {
        if (active) {
          setGoogleConfig({ enabled: false });
        }
      } finally {
        if (active) {
          setLoadingGoogleConfig(false);
        }
      }
    }

    void loadGoogleConfig();

    return () => {
      active = false;
    };
  }, []);

  const submit = async (action: AuthMode) => {
    setLoading(true);
    setError('');

    try {
      const endpoint = action === 'login'
        ? '/api/auth/customer/login'
        : '/api/auth/customer/register';

      const payload = action === 'login'
        ? { identifier, password }
        : { username, name, email, password };

      if (action === 'register' && password !== confirmPassword) {
        throw new Error('Passwords do not match.');
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed.');
      }

      window.location.replace(returnTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-4xl flex-col justify-center px-6 pb-16 pt-40 md:pt-44">
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-700">Customer Access</p>
          <h1 className="mt-3 font-serif text-3xl text-zinc-900">Continue with Google or email</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            The Google button works for both first-time registration and returning sign-in. If the email already exists, the same button logs the customer back in.
          </p>

          {googleConfig.enabled ? (
            <a
              href={`${googleConfig.startUrl || '/api/auth/google/start'}?returnTo=${encodeURIComponent(returnTo)}`}
              className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-amber-600"
            >
              Continue with Google
            </a>
          ) : (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
              {loadingGoogleConfig
                ? 'Checking Google sign-in availability...'
                : 'Google sign-in is not configured yet. Enable the OAuth client in GCP and add the credentials to this app.'}
            </div>
          )}

          <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-500">
            Google creates or resumes the same customer session. Password login remains available as a fallback.
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${mode === 'login' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600'}`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${mode === 'register' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600'}`}
            >
              Register
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {mode === 'login' ? (
            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">Username or email</label>
                <input
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-300"
                  autoComplete="username"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-300"
                  autoComplete="current-password"
                />
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={() => submit('login')}
                className="w-full rounded-xl bg-amber-500 px-5 py-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-amber-400 disabled:opacity-60"
              >
                {loading ? 'Signing in...' : 'Login'}
              </button>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">Full name</label>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-300"
                  autoComplete="name"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">Username</label>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-300"
                  autoComplete="username"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-300"
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-300"
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">Confirm password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-300"
                  autoComplete="new-password"
                />
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={() => submit('register')}
                className="w-full rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:opacity-60"
              >
                {loading ? 'Creating account...' : 'Create account'}
              </button>
            </div>
          )}

          <p className="mt-6 text-xs leading-6 text-zinc-500">
            By continuing, the customer can access order history, invoices, and downloads from{' '}
            <Link href="/account/orders" className="font-medium text-zinc-700 underline underline-offset-2">
              the account area
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}

