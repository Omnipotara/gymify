import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { getCheckinQrPayload } from '../features/gyms/api';
import { getMyGyms } from '../features/gyms/api';
import { useQuery } from '@tanstack/react-query';

const REFRESH_INTERVAL_MS = 28_000; // refresh 2s before 30s expiry

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

  // Initial fetch + periodic refresh
  useEffect(() => {
    fetchQr();
    const id = setInterval(fetchQr, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchQr]);

  // Countdown tick
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
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 select-none">
      <div className="flex flex-col items-center gap-8 max-w-sm w-full">
        <div className="text-center space-y-1">
          {gym && <p className="text-sm font-medium text-gray-400 uppercase tracking-widest">{gym.name}</p>}
          <p className="text-2xl font-semibold text-gray-800">Scan with app to check in</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-lg border border-gray-100">
          {error ? (
            <div className="w-64 h-64 flex items-center justify-center">
              <p className="text-sm text-red-500 text-center">{error}</p>
            </div>
          ) : qrValue ? (
            <QRCode value={qrValue} size={256} />
          ) : (
            <div className="w-64 h-64 flex items-center justify-center">
              <div className="h-8 w-8 rounded-full border-2 border-gray-300 border-t-blue-500 animate-spin" />
            </div>
          )}
        </div>

        {/* Countdown bar */}
        <div className="w-full space-y-1.5">
          <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-none"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-center text-gray-400">
            {timeLeft > 0 ? `New code in ${timeLeft}s` : 'Refreshing…'}
          </p>
        </div>
      </div>
    </div>
  );
}
