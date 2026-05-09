import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Dumbbell } from 'lucide-react';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { useAuth } from '../lib/auth-context';
import { register } from '../features/auth/api';
import { ApiError } from '../lib/api-client';

const inputClass =
  'w-full rounded-xl border px-4 py-3 text-sm transition-colors ' +
  'bg-white border-border text-foreground placeholder:text-muted-foreground ' +
  'dark:bg-white/10 dark:border-white/20 dark:text-white dark:placeholder:text-white/40 ' +
  'focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-white/30';

const phoneWrapperClass =
  'w-full rounded-xl border px-4 py-3 text-sm transition-colors ' +
  'bg-white border-border text-foreground ' +
  'dark:bg-white/10 dark:border-white/20 dark:text-white ' +
  'focus-within:ring-2 focus-within:ring-primary dark:focus-within:ring-white/30';

export default function RegisterPage() {
  const { login: setAuth } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState<string | undefined>(undefined);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await register({ email, password, full_name: fullName || undefined, phone });
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
            Create your account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground dark:text-white/80">
              Full name <span className="text-muted-foreground dark:text-white/40 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Doe"
              className={inputClass}
            />
          </div>

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
            <label className="block text-sm font-medium text-foreground dark:text-white/80">
              Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground dark:text-white/80">
              Phone <span className="text-muted-foreground dark:text-white/40 font-normal">(optional)</span>
            </label>
            <div className={phoneWrapperClass}>
              <PhoneInput
                international
                defaultCountry="RS"
                value={phone}
                onChange={(val) => setPhone(val)}
              />
            </div>
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
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground dark:text-white/50">
          Already have an account?{' '}
          <Link to="/login" className="text-primary dark:text-blue-300 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
