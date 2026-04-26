import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { getMyGyms, joinGym } from '../features/gyms/api';
import { QrScanner } from '../components/QrScanner';
import { ApiError } from '../lib/api-client';

export default function GymListPage() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['my-gyms'],
    queryFn: getMyGyms,
  });

  const joinMutation = useMutation({
    mutationFn: joinGym,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-gyms'] });
      setScanning(false);
      setScanError('');
    },
    onError: (err) => {
      setScanError(err instanceof ApiError ? err.message : 'Failed to join gym');
    },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">My Gyms</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{user?.email}</span>
          <Link to="/profile" className="text-sm text-blue-600 hover:underline">Profile</Link>
          <button onClick={logout} className="text-sm text-red-500 hover:text-red-700">
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-lg p-4 space-y-4">
        {isLoading && <p className="text-center text-gray-400 py-8">Loading…</p>}

        {data?.gyms.length === 0 && (
          <p className="text-center text-gray-400 py-8">
            No gyms yet. Scan a join QR to get started.
          </p>
        )}

        {data?.gyms.map((gym) => (
          <Link
            key={gym.id}
            to={`/gyms/${gym.id}`}
            className="block rounded-xl bg-white p-4 shadow-sm hover:shadow transition-shadow"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900">{gym.name}</span>
              <span className="text-xs text-gray-400 capitalize">{gym.role}</span>
            </div>
          </Link>
        ))}

        <button
          onClick={() => { setScanning(true); setScanError(''); }}
          className="w-full rounded-xl border-2 border-dashed border-gray-300 py-4 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors"
        >
          + Scan join QR to add a gym
        </button>

        {scanning && (
          <div className="rounded-xl bg-white p-4 shadow space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">Point camera at the join QR</p>
              <button onClick={() => setScanning(false)} className="text-xs text-gray-400 hover:text-gray-600">
                Cancel
              </button>
            </div>
            <QrScanner
              onScan={(payload) => joinMutation.mutate(payload)}
              onError={(err) => setScanError(err.message)}
            />
            {scanError && <p className="text-sm text-red-600">{scanError}</p>}
            {joinMutation.isPending && <p className="text-sm text-gray-400">Joining…</p>}
          </div>
        )}
      </main>
    </div>
  );
}
