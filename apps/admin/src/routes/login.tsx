import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { CeolxLogo } from '@/components/CeolxLogo';
import { authClient } from '@/lib/auth-client';

async function getAdminSessionSafely() {
  try {
    const { data } = await authClient.getSession();
    return data;
  } catch {
    // Backend offline / network error → treat as no session.
    return null;
  }
}

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    // Already-authenticated admins get bounced straight to the dashboard.
    const data = await getAdminSessionSafely();
    if (data?.user && data.user.currentRole === 'admin') {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({ to: '/dashboard' });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const { data, error: authError } = await authClient.signIn.email({ email, password });
      if (authError) {
        setError(
          authError.status === 429
            ? 'Too many attempts. Please try again in a few minutes.'
            : 'Invalid email or password.'
        );
        return;
      }

      if (data?.user.currentRole !== 'admin') {
        await authClient.signOut();
        setError('This account does not have admin access.');
        return;
      }

      await navigate({ to: '/dashboard' });
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col bg-[#0d0c0f] text-white">
      <header className="flex items-center justify-between px-6 py-5">
        <CeolxLogo />
        <span className="text-xs tracking-widest uppercase text-white/50">Admin</span>
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          <h1
            className="text-white mb-8"
            style={{
              fontFamily: 'Urbanist, sans-serif',
              fontSize: 36,
              fontWeight: 700,
              lineHeight: 1.1,
            }}
          >
            Login to your account
          </h1>

          {error && (
            <div className="bg-red-500/15 border border-red-500/30 rounded-lg p-3 mb-4">
              <p className="text-red-300 text-sm font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-white/80">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                autoCapitalize="none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@ceolx.ie"
                className="w-full bg-white text-black placeholder:text-gray-500 rounded-lg h-12 px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-[var(--ceolx-blue)]"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-white/80">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white text-black placeholder:text-gray-500 rounded-lg h-12 px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-[var(--ceolx-blue)]"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full h-12 mt-6 font-bold tracking-wide uppercase text-white bg-[var(--ceolx-blue)] hover:opacity-90 active:opacity-80 transition disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontFamily: 'Urbanist, sans-serif' }}
            >
              {isSubmitting ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-white/40">
            Internal CeolX Super Admin · access by invitation only
          </p>
        </div>
      </main>
    </div>
  );
}
