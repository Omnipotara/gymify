import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle } from 'lucide-react';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { getMe, updateMe } from '../features/users/api';
import { ApiError } from '../lib/api-client';

const inputCls =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground ' +
  'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';

export default function ProfilePage() {
  const queryClient = useQueryClient();

  const { data: me, isLoading } = useQuery({
    queryKey: ['me-profile'],
    queryFn: getMe,
  });

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState<string | undefined>(undefined);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (me) {
      setFullName(me.full_name ?? '');
      setPhone(me.phone ?? undefined);
    }
  }, [me]);

  const mutation = useMutation({
    mutationFn: () => updateMe({ full_name: fullName.trim() || null, phone: phone ?? null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me-profile'] });
      setSaved(true);
      setError('');
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to save'),
  });

  return (
    <main className="mx-auto max-w-sm p-4 space-y-4">
      {isLoading && (
        <p className="text-center text-muted-foreground py-12 text-sm">Loading…</p>
      )}

      {me && (
        <div className="rounded-2xl bg-card border border-border p-6 space-y-5">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email</label>
            <p className="text-sm text-foreground bg-secondary rounded-lg px-3 py-2">{me.email}</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Full name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Phone number</label>
            <PhoneInput
              international
              defaultCountry="RS"
              value={phone}
              onChange={(val) => setPhone(val)}
            />
            {phone && (
              <button
                onClick={() => setPhone(undefined)}
                className="mt-1.5 text-xs text-destructive hover:underline"
              >
                Remove phone number
              </button>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {saved && (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle className="w-4 h-4" />
              <p className="text-sm font-medium">Saved!</p>
            </div>
          )}

          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="w-full rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-semibold
              hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {mutation.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      )}
    </main>
  );
}
