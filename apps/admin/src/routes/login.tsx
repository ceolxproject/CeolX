import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { Eye, EyeOff } from 'lucide-react';
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
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="min-h-screen w-full flex flex-col bg-surface-dark text-white">
      <header className="flex items-center justify-between px-6 py-5">
        <CeolxLogo fontSize={22} />
        <span className="text-xs tracking-widest uppercase text-white/50">Admin</span>
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          <h1 className="text-4xl font-bold leading-tight mb-8 text-center">
            Login to your account
          </h1>

          {error && (
            <div className="bg-destructive/15 border border-destructive/30 rounded-lg p-3 mb-4">
              <p className="text-destructive text-sm font-medium">{error}</p>
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
                placeholder="Enter Email"
                className="w-full h-12 px-4 rounded-md bg-surface-white text-surface-dark placeholder:text-muted-foreground text-base font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-white/80">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter Password"
                  className="w-full h-12 pl-4 pr-12 rounded-md bg-surface-white text-surface-dark placeholder:text-muted-foreground text-base font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-surface-dark transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 mt-6 rounded-md font-bold tracking-wide uppercase text-primary-foreground bg-primary hover:opacity-90 active:opacity-80 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
