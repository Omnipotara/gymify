import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Dumbbell, ArrowLeft } from 'lucide-react';
import { forgotPassword, resetPassword } from '../features/auth/api';
import { ApiError } from '../lib/api-client';

type Step = 'request' | 'verify';

const inputClass =
  'w-full rounded-xl border px-4 py-3 text-sm transition-colors ' +
  'bg-white border-border text-foreground placeholder:text-muted-foreground ' +
  'dark:bg-white/10 dark:border-white/20 dark:text-white dark:placeholder:text-white/40 ' +
  'focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-white/30';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await forgotPassword({ email });
      setStep('verify');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await resetPassword({ email, code, new_password: newPassword });
      navigate('/login', { state: { resetSuccess: true } });
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
          <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground dark:text-white">
            {step === 'request' ? 'Reset Password' : 'Enter Code'}
          </h1>
          <p className="text-sm text-muted-foreground dark:text-white/50 mt-1">
            {step === 'request'
              ? "We'll send a 6-digit code to your email"
              : <>Check <span className="font-medium dark:text-white/80">{email}</span> for your code</>}
          </p>
        </div>

        {step === 'request' ? (
          <form onSubmit={handleRequest} className="space-y-4">
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

            {error && <p className="text-sm text-destructive dark:text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 rounded-xl py-3.5 text-sm font-semibold transition-all
                bg-primary text-primary-foreground hover:bg-primary/90
                dark:bg-white dark:text-[#0d2251] dark:hover:bg-white/90
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending…' : 'Send reset code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground dark:text-white/80">
                6-digit code
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className={
                  inputClass + ' text-center text-2xl font-mono tracking-[0.5em] font-bold'
                }
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground dark:text-white/80">
                New password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className={inputClass}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground dark:text-white/80">
                Confirm password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Same as above"
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
              {loading ? 'Resetting…' : 'Reset password'}
            </button>

            <button
              type="button"
              onClick={() => { setStep('request'); setError(''); setCode(''); }}
              className="w-full text-sm text-muted-foreground dark:text-white/50 hover:text-foreground dark:hover:text-white/80 transition-colors py-1"
            >
              Didn't get the code? Send again
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground dark:text-white/50">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-primary dark:text-blue-300 hover:underline"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
