import { Scanner } from '@yudiel/react-qr-scanner';

interface Props {
  onScan: (payload: unknown) => void;
  onError?: (err: Error) => void;
}

export function QrScanner({ onScan, onError }: Props) {
  return (
    <div className="overflow-hidden rounded-xl">
      <Scanner
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
  );
}
