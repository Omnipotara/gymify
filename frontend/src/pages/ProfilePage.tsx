import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { getMe, updateMe } from '../features/users/api';
import { ApiError } from '../lib/api-client';

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
    mutationFn: () =>
      updateMe({
        full_name: fullName.trim() || null,
        phone: phone ?? null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me-profile'] });
      setSaved(true);
      setError('');
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to save'),
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white px-4 py-3 flex items-center gap-3">
        <Link to="/gyms" className="text-sm text-blue-600 hover:underline">← My Gyms</Link>
        <h1 className="text-lg font-semibold text-gray-900">My Profile</h1>
      </header>

      <main className="mx-auto max-w-sm p-4 space-y-4">
        {isLoading && <p className="text-center text-gray-400 py-8">Loading…</p>}

        {me && (
          <div className="rounded-xl bg-white p-6 shadow-sm space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
              <p className="text-sm text-gray-700">{me.email}</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Full name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Phone number</label>
              <div className="phone-input-wrapper">
                <PhoneInput
                  international
                  defaultCountry="RS"
                  value={phone}
                  onChange={(val) => setPhone(val)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              {phone && (
                <button
                  onClick={() => setPhone(undefined)}
                  className="mt-1 text-xs text-red-500 hover:underline"
                >
                  Remove phone number
                </button>
              )}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {saved && <p className="text-sm text-green-600">Saved!</p>}

            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
