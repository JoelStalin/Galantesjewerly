"use client";

import { useState } from 'react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        window.location.replace('/admin/dashboard');
        return;
      }

      const data = await res.json();
      setError(data.error || 'Authentication failed');
    } catch {
      setError('Could not connect to the authentication panel');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 relative overflow-hidden bg-gradient-to-br from-zinc-50 to-zinc-100 min-h-[70vh]">
      {/* Decorative decorative blob */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-72 h-72 rounded-full bg-amber-100 blur-3xl opacity-50 z-0"></div>

      <div className="w-full max-w-sm bg-white/80 backdrop-blur border border-zinc-200 p-10 rounded-2xl shadow-xl z-10">
        <h1 className="text-3xl font-serif text-center mb-8 text-zinc-900 border-b border-zinc-100 pb-6 tracking-wide">Secure Access</h1>

        {error && (
          <div className="bg-red-50/80 border border-red-100 text-red-600 p-3 rounded-lg mb-6 text-sm text-center animate-pulse">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Authorized User</label>
            <input
              autoComplete="username"
              data-testid="login-username"
              id="username"
              name="username"
              type="text"
              value={username} onChange={e => setUsername(e.target.value)}
              className="w-full border border-zinc-200 bg-white rounded-lg p-3 text-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition-all" required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Vault Key</label>
            <input
              autoComplete="current-password"
              data-testid="login-password"
              id="password"
              name="password"
              type="password"
              value={password} onChange={e => setPassword(e.target.value)}
              className="w-full border border-zinc-200 bg-white rounded-lg p-3 text-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition-all" required
            />
          </div>
          <button
            data-testid="login-submit"
            type="submit" disabled={loading}
            className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-medium py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg mt-4"
          >
            {loading ? 'Decrypting...' : 'Unlock Panel'}
          </button>
        </form>
      </div>
    </div>
  );
}
