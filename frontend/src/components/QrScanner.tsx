import { useState, useEffect } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';

interface Props {
  onScan: (payload: unknown) => void;
  onError?: (err: Error) => void;
}

export function QrScanner({ onScan, onError }: Props) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');

  async function loadDevices() {
    const all = await navigator.mediaDevices.enumerateDevices();
    const cameras = all.filter((d) => d.kind === 'videoinput');
    setDevices(cameras);
  }

  useEffect(() => {
    // First call: may return empty labels before permission is granted
    loadDevices();
    // Second call after scanner starts and grants permission — labels populate
    const t = setTimeout(loadDevices, 1500);
    return () => clearTimeout(t);
  }, []);

  const constraints: MediaTrackConstraints | undefined = selectedId
    ? { deviceId: { exact: selectedId } }
    : undefined;

  return (
    <div className="space-y-2">
      {devices.length > 1 && (
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">Default camera</option>
          {devices.map((d, i) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `Camera ${i + 1}`}
            </option>
          ))}
        </select>
      )}
      <div className="overflow-hidden rounded-xl">
        {/* key forces a remount when the selected camera changes */}
        <Scanner
          key={selectedId || 'default'}
          constraints={constraints}
          onScan={(results) => {
            const raw = results[0]?.rawValue;
            if (!raw) return;
            try {
              onScan(JSON.parse(raw));
            } catch {
              onError?.(new Error('Could not read QR code'));
            }
          }}
          onError={(err) => onError?.(err instanceof Error ? err : new Error(String(err)))}
          styles={{ container: { width: '100%', maxWidth: 320 } }}
        />
      </div>
    </div>
  );
}
