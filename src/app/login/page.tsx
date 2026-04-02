'use client';

import { createClient } from '@/lib/supabase/client';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

function subscribe() {
  return () => {};
}

export default function LoginPage() {
  const isMounted = useSyncExternalStore(subscribe, () => true, () => false);
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isMounted) return;

    let active = true;

    async function redirectIfReady() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active || !user) return;

      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (employee) {
        window.location.replace('/orders/new');
      }
    }

    void redirectIfReady();

    return () => {
      active = false;
    };
  }, [isMounted, supabase]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Unable to sign in' }));
      setError(data.error || 'Unable to sign in');
      setLoading(false);
      return;
    }

    window.location.replace('/orders/new');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-2xl p-8 shadow-sm border border-gray-200">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">OSSO Hub</h1>
          <p className="text-gray-500 mt-2">Point of Sale System</p>
        </div>

        {isMounted ? (
          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                suppressHydrationWarning
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="you@osso.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                suppressHydrationWarning
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="********"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <div className="space-y-5" aria-hidden="true">
            <div className="space-y-2">
              <div className="h-5 w-12 rounded bg-gray-200" />
              <div className="h-12 w-full rounded-lg bg-gray-200" />
            </div>
            <div className="space-y-2">
              <div className="h-5 w-20 rounded bg-gray-200" />
              <div className="h-12 w-full rounded-lg bg-gray-200" />
            </div>
            <div className="h-12 w-full rounded-lg bg-gray-100" />
          </div>
        )}

        <p className="text-center text-gray-400 text-xs mt-6">
          HIPAA &amp; CCPA Compliant | Encrypted | Audited
        </p>
      </div>
    </div>
  );
}
