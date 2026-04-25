import { useState, useEffect } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';

interface Props {
  onScan: (payload: unknown) => void;
  onError?: (err: Error) => void;
}

export function QrScanner({ onScan, onError }: Props) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((all) => {
      const cameras = all.filter((d) => d.kind === 'videoinput');
      setDevices(cameras);
      // Default to the last camera — on most setups the physical camera comes after virtual ones
      if (cameras.length > 0) setDeviceId(cameras[cameras.length - 1].deviceId);
    });
  }, []);

  return (
    <div className="space-y-2">
      {devices.length > 1 && (
        <select
          value={deviceId}
          onChange={(e) => setDeviceId(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        >
          {devices.map((d, i) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `Camera ${i + 1}`}
            </option>
          ))}
        </select>
      )}
      <div className="overflow-hidden rounded-xl">
        <Scanner
          constraints={{ deviceId: deviceId ? { exact: deviceId } : undefined }}
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
