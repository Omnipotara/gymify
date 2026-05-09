import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { Dumbbell } from 'lucide-react';
import { getCheckinQrPayload, getMyGyms } from '../features/gyms/api';
import { useQuery } from '@tanstack/react-query';

const REFRESH_INTERVAL_MS = 28_000;

export default function CheckinDisplayPage() {
  const { gymId } = useParams<{ gymId: string }>();
  const [qrValue, setQrValue] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [error, setError] = useState('');

  const { data: gymsData } = useQuery({ queryKey: ['my-gyms'], queryFn: getMyGyms });
  const gym = gymsData?.gyms.find((g) => g.id === gymId);

  const fetchQr = useCallback(async () => {
    if (!gymId) return;
    try {
      setError('');
      const data = await getCheckinQrPayload(gymId);
      setQrValue(JSON.stringify(data.payload));
      setExpiresAt(data.expires_at);
    } catch {
      setError('Failed to load QR code. Please refresh the page.');
    }
  }, [gymId]);

  useEffect(() => {
    fetchQr();
    const id = setInterval(fetchQr, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchQr]);

  useEffect(() => {
    if (expiresAt === 0) return;
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);
    }, 200);
    return () => clearInterval(id);
  }, [expiresAt]);

  const progress = expiresAt > 0 ? Math.max(0, (expiresAt - Date.now()) / 30_000) * 100 : 100;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 select-none">
      <div className="flex flex-col items-center gap-8 max-w-sm w-full">
        {/* Gym header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Dumbbell className="w-5 h-5 text-primary" />
            <span className="font-heading text-lg font-bold text-muted-foreground uppercase tracking-widest">
              {gym?.name ?? 'Gymify'}
            </span>
          </div>
          <p className="font-heading text-3xl font-bold text-foreground">
            Scan to check in
          </p>
          <p className="text-sm text-muted-foreground">Open the Gymify app and point your camera here</p>
        </div>

        {/* QR code */}
        <div className="rounded-3xl bg-white p-6 shadow-2xl">
          {error ? (
            <div className="w-64 h-64 flex items-center justify-center">
              <p className="text-sm text-red-500 text-center">{error}</p>
            </div>
          ) : qrValue ? (
            <QRCode value={qrValue} size={256} />
          ) : (
            <div className="w-64 h-64 flex items-center justify-center">
              <div className="h-8 w-8 rounded-full border-2 border-gray-200 border-t-blue-500 animate-spin" />
            </div>
          )}
        </div>

        {/* Countdown bar */}
        <div className="w-full space-y-2">
          <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-none"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-center text-muted-foreground">
            {timeLeft > 0 ? `Refreshes in ${timeLeft}s` : 'Refreshing…'}
          </p>
        </div>
      </div>
    </div>
  );
}
