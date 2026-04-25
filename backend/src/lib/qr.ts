import crypto from 'crypto';

export type QrType = 'join' | 'checkin';

export interface QrPayload {
  v: number;
  type: QrType;
  gym_id: string;
  sig: string;
}

function computeHmac(secret: string, v: number, type: QrType, gymId: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`${v}:${type}:${gymId}`)
    .digest('hex');
}

export function signQrPayload(type: QrType, gymId: string, secret: string): QrPayload {
  const v = 1;
  return { v, type, gym_id: gymId, sig: computeHmac(secret, v, type, gymId) };
}

/**
 * Verifies a QR payload against the expected type and secret.
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

  if (p['v'] !== 1) throw new Error('Invalid QR payload');
  if (typeof p['gym_id'] !== 'string' || !p['gym_id']) throw new Error('Invalid QR payload');
  if (typeof p['sig'] !== 'string' || !p['sig']) throw new Error('Invalid QR payload');
  if (p['type'] !== expectedType) throw new Error('Invalid QR payload');

  const gymId = p['gym_id'] as string;
  const expected = computeHmac(secret, 1, expectedType, gymId);
  const expectedBuf = Buffer.from(expected, 'hex');
  const actualBuf = Buffer.from(p['sig'] as string, 'hex');

  if (
    expectedBuf.length !== actualBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, actualBuf)
  ) {
    throw new Error('Invalid QR payload');
  }

  return { gym_id: gymId };
}
