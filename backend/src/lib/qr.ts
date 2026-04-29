import crypto from 'crypto';

export type QrType = 'join' | 'checkin';

export interface QrPayload {
  v: number;
  type: QrType;
  gym_id: string;
  sig: string;
}

export interface RotatingQrPayload extends QrPayload {
  ts: number;
}

// v=1: static QR, signed over v:type:gym_id
function computeHmac(secret: string, v: number, type: QrType, gymId: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`${v}:${type}:${gymId}`)
    .digest('hex');
}

// v=2: rotating QR, signed over v:type:gym_id:ts
function computeRotatingHmac(secret: string, v: number, type: QrType, gymId: string, ts: number): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`${v}:${type}:${gymId}:${ts}`)
    .digest('hex');
}

function timingSafeCompare(expected: string, actual: string): void {
  const expectedBuf = Buffer.from(expected, 'hex');
  const actualBuf = Buffer.from(actual, 'hex');
  if (
    expectedBuf.length !== actualBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, actualBuf)
  ) {
    throw new Error('Invalid QR payload');
  }
}

export function signQrPayload(type: QrType, gymId: string, secret: string): QrPayload {
  const v = 1;
  return { v, type, gym_id: gymId, sig: computeHmac(secret, v, type, gymId) };
}

export function signRotatingCheckinPayload(gymId: string, secret: string): RotatingQrPayload {
  const v = 2;
  const ts = Date.now();
  const sig = computeRotatingHmac(secret, v, 'checkin', gymId, ts);
  return { v, type: 'checkin', gym_id: gymId, ts, sig };
}

// 30-second window + 5-second buffer for network latency
const ROTATING_QR_TTL_MS = 35_000;

/**
 * Verifies a QR payload against the expected type and secret.
 * Accepts v=1 (static) and v=2 (rotating, validates timestamp).
 * Returns the verified gym_id on success; throws on any failure.
 * Always throws a generic error — callers must not forward error details to clients.
 */
export function verifyQrPayload(
  raw: unknown,
  expectedType: QrType,
  secret: string,
): { gym_id: string } {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid QR payload');

  const p = raw as Record<string, unknown>;

  if (typeof p['gym_id'] !== 'string' || !p['gym_id']) throw new Error('Invalid QR payload');
  if (typeof p['sig'] !== 'string' || !p['sig']) throw new Error('Invalid QR payload');
  if (p['type'] !== expectedType) throw new Error('Invalid QR payload');

  const gymId = p['gym_id'] as string;

  if (p['v'] === 1) {
    const expected = computeHmac(secret, 1, expectedType, gymId);
    timingSafeCompare(expected, p['sig'] as string);
  } else if (p['v'] === 2) {
    if (typeof p['ts'] !== 'number') throw new Error('Invalid QR payload');
    const ts = p['ts'] as number;
    const age = Date.now() - ts;
    if (age < 0 || age > ROTATING_QR_TTL_MS) throw new Error('QR code expired');
    const expected = computeRotatingHmac(secret, 2, expectedType, gymId, ts);
    timingSafeCompare(expected, p['sig'] as string);
  } else {
    throw new Error('Invalid QR payload');
  }

  return { gym_id: gymId };
}
