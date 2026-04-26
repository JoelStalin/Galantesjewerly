'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type AuthMode = 'login' | 'register';

function sanitizeReturnTo(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/account/settings';
  }

  return value;
}

export default function CustomerLoginPage() {
  const searchParams = useSearchParams();
  const returnTo = useMemo(() => sanitizeReturnTo(searchParams.get('returnTo')), [searchParams]);
  const [mode, setMode] = useState<AuthMode>('login');
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    <div className="mx-auto flex min-h-[70vh] max-w-4xl flex-col justify-center px-6 py-16">
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-700">Customer Access</p>
          <h1 className="mt-3 font-serif text-3xl text-zinc-900">Sign in with Google or password</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Customers can keep using Google, or create a traditional account with username and password.
          </p>

          <a
            href={`/api/auth/google/start?returnTo=${encodeURIComponent(returnTo)}`}
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-amber-600"
          >
            Continue with Google
          </a>

          <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-500">
            Use this if you already have a Google account connected to your customer profile.
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
        </section>
      </div>
    </div>
  );
}

