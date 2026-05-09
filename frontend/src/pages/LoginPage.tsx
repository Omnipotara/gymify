import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Dumbbell } from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { login } from '../features/auth/api';
import { ApiError } from '../lib/api-client';

const inputClass =
  'w-full rounded-xl border px-4 py-3 text-sm transition-colors ' +
  'bg-white border-border text-foreground placeholder:text-muted-foreground ' +
  'dark:bg-white/10 dark:border-white/20 dark:text-white dark:placeholder:text-white/40 ' +
  'focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-white/30';

export default function LoginPage() {
  const { login: setAuth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const resetSuccess = (location.state as { resetSuccess?: boolean } | null)?.resetSuccess;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login({ email, password });
      setAuth(res.user);
      navigate('/gyms', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-gradient min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 dark:bg-white/10 mb-4">
            <Dumbbell className="w-8 h-8 text-primary dark:text-white" />
          </div>
          <h1 className="font-heading text-5xl font-bold tracking-tight text-foreground dark:text-white">
            Gymify
          </h1>
          <p className="text-sm text-muted-foreground dark:text-white/50 mt-1">
            Sign in to your account
          </p>
        </div>

        {resetSuccess && (
          <div className="mb-4 rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-600 dark:text-green-400">
            Password reset successfully. Sign in with your new password.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground dark:text-white/80">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground dark:text-white/80">
                Password
              </label>
              <Link to="/forgot-password" className="text-xs text-primary dark:text-blue-300 hover:underline">
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={inputClass}
            />
          </div>

          {error && <p className="text-sm text-destructive dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 rounded-xl py-3.5 text-sm font-semibold transition-all
              bg-primary text-primary-foreground hover:bg-primary/90
              dark:bg-white dark:text-[#0d2251] dark:hover:bg-white/90
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground dark:text-white/50">
          No account?{' '}
          <Link to="/register" className="text-primary dark:text-blue-300 font-medium hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
