import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ChevronRight, ScanLine, Dumbbell } from 'lucide-react';
import { getMyGyms, joinGym } from '../features/gyms/api';
import { QrScanner } from '../components/QrScanner';
import { ApiError } from '../lib/api-client';

export default function GymListPage() {
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
    <main className="mx-auto max-w-lg p-4 space-y-3">
      {isLoading && (
        <p className="text-center text-muted-foreground py-12 text-sm">Loading…</p>
      )}

      {!isLoading && data?.gyms.length === 0 && (
        <div className="text-center py-16 space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-2">
            <Dumbbell className="w-7 h-7 text-primary" />
          </div>
          <p className="font-heading text-2xl font-bold">No gyms yet</p>
          <p className="text-sm text-muted-foreground">Scan a join QR code to get started.</p>
        </div>
      )}

      {data?.gyms.map((gym) => (
        <Link
          key={gym.id}
          to={gym.role === 'admin' ? `/gyms/${gym.id}/admin` : `/gyms/${gym.id}`}
          className="flex items-center justify-between rounded-2xl bg-card border border-border px-4 py-4
            hover:border-primary/40 hover:bg-primary/5 transition-colors group"
        >
          <div>
            <p className="font-medium text-foreground">{gym.name}</p>
            <span className={`inline-block mt-1 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
              gym.role === 'admin'
                ? 'bg-primary/10 text-primary'
                : 'bg-secondary text-muted-foreground'
            }`}>
              {gym.role}
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </Link>
      ))}

      <button
        onClick={() => { setScanning(!scanning); setScanError(''); }}
        className="w-full rounded-2xl border-2 border-dashed border-border py-5 text-sm
          text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors
          flex items-center justify-center gap-2"
      >
        <ScanLine className="w-4 h-4" />
        Scan join QR to add a gym
      </button>

      {scanning && (
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <p className="text-sm font-medium">Point camera at the join QR</p>
            <button
              onClick={() => setScanning(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
          <div className="p-4 space-y-3">
            <QrScanner
              onScan={(payload) => joinMutation.mutate(payload)}
              onError={(err) => setScanError(err.message)}
            />
            {scanError && <p className="text-sm text-destructive">{scanError}</p>}
            {joinMutation.isPending && (
              <p className="text-sm text-muted-foreground text-center">Joining…</p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
