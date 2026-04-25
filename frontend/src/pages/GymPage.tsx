import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCheckInHistory, checkIn } from '../features/checkins/api';
import { QrScanner } from '../components/QrScanner';
import { ApiError } from '../lib/api-client';

export default function GymPage() {
  const { gymId } = useParams<{ gymId: string }>();
  const queryClient = useQueryClient();
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [lastCheckIn, setLastCheckIn] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['check-ins', gymId],
    queryFn: () => getCheckInHistory(gymId!),
    enabled: !!gymId,
  });

  const checkInMutation = useMutation({
    mutationFn: (payload: unknown) => checkIn(gymId!, payload),
    onSuccess: (ci) => {
      queryClient.invalidateQueries({ queryKey: ['check-ins', gymId] });
      setScanning(false);
      setScanError('');
      setLastCheckIn(new Date(ci.checked_in_at).toLocaleTimeString());
    },
    onError: (err) => {
      setScanError(err instanceof ApiError ? err.message : 'Check-in failed');
    },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white px-4 py-3 flex items-center gap-3">
        <Link to="/gyms" className="text-sm text-blue-600 hover:underline">
          ← My Gyms
        </Link>
        <h1 className="text-lg font-semibold text-gray-900">Check-in History</h1>
      </header>

      <main className="mx-auto max-w-lg p-4 space-y-4">
        {lastCheckIn && (
          <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
            ✓ Checked in at {lastCheckIn}
          </div>
        )}

        <button
          onClick={() => { setScanning(true); setScanError(''); setLastCheckIn(''); }}
          className="w-full rounded-xl bg-blue-600 py-3 text-sm font-medium text-white hover:bg-blue-700"
        >
          Check In
        </button>

        {scanning && (
          <div className="rounded-xl bg-white p-4 shadow space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">Point camera at the check-in QR</p>
              <button onClick={() => setScanning(false)} className="text-xs text-gray-400 hover:text-gray-600">
                Cancel
              </button>
            </div>
            <QrScanner
              onScan={(payload) => checkInMutation.mutate(payload)}
              onError={(err) => setScanError(err.message)}
            />
            {scanError && <p className="text-sm text-red-600">{scanError}</p>}
            {checkInMutation.isPending && <p className="text-sm text-gray-400">Checking in…</p>}
          </div>
        )}

        <div className="space-y-2">
          <h2 className="text-sm font-medium text-gray-500">Recent visits</h2>
          {isLoading && <p className="text-center text-gray-400 py-4">Loading…</p>}
          {data?.items.length === 0 && (
            <p className="text-center text-gray-400 py-4">No check-ins yet.</p>
          )}
          {data?.items.map((ci) => (
            <div key={ci.id} className="rounded-lg bg-white px-4 py-3 shadow-sm text-sm text-gray-700">
              {new Date(ci.checked_in_at).toLocaleString()}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
