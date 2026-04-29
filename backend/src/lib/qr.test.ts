import { describe, it, expect, vi, afterEach } from 'vitest';
import { signQrPayload, signRotatingCheckinPayload, verifyQrPayload } from './qr';

const GYM_ID = 'gym-abc-123';
const SECRET = 'test-secret-key';
const WRONG_SECRET = 'wrong-secret-key';

// ── v=1 static QR ──────────────────────────────────────────────────────────────

describe('v=1 static QR', () => {
  it('round-trips a join QR', () => {
    const payload = signQrPayload('join', GYM_ID, SECRET);
    expect(verifyQrPayload(payload, 'join', SECRET)).toEqual({ gym_id: GYM_ID });
  });

  it('round-trips a checkin QR', () => {
    const payload = signQrPayload('checkin', GYM_ID, SECRET);
    expect(verifyQrPayload(payload, 'checkin', SECRET)).toEqual({ gym_id: GYM_ID });
  });

  it('rejects a join QR presented as checkin', () => {
    const payload = signQrPayload('join', GYM_ID, SECRET);
    expect(() => verifyQrPayload(payload, 'checkin', SECRET)).toThrow();
  });

  it('rejects a checkin QR presented as join', () => {
    const payload = signQrPayload('checkin', GYM_ID, SECRET);
    expect(() => verifyQrPayload(payload, 'join', SECRET)).toThrow();
  });

  it('rejects a tampered gym_id', () => {
    const payload = { ...signQrPayload('join', GYM_ID, SECRET), gym_id: 'other-gym' };
    expect(() => verifyQrPayload(payload, 'join', SECRET)).toThrow();
  });

  it('rejects a tampered sig', () => {
    const payload = { ...signQrPayload('join', GYM_ID, SECRET), sig: 'aa'.repeat(32) };
    expect(() => verifyQrPayload(payload, 'join', SECRET)).toThrow();
  });

  it('rejects the wrong secret', () => {
    const payload = signQrPayload('join', GYM_ID, SECRET);
    expect(() => verifyQrPayload(payload, 'join', WRONG_SECRET)).toThrow();
  });

  it('rejects null', () => {
    expect(() => verifyQrPayload(null, 'join', SECRET)).toThrow();
  });

  it('rejects a non-object (string)', () => {
    expect(() => verifyQrPayload('not-an-object', 'join', SECRET)).toThrow();
  });

  it('rejects an empty object', () => {
    expect(() => verifyQrPayload({}, 'join', SECRET)).toThrow();
  });

  it('rejects an unknown version number', () => {
    const payload = { ...signQrPayload('join', GYM_ID, SECRET), v: 99 };
    expect(() => verifyQrPayload(payload, 'join', SECRET)).toThrow();
  });

  it('different gyms produce different signatures with the same secret', () => {
    const a = signQrPayload('checkin', 'gym-1', SECRET);
    const b = signQrPayload('checkin', 'gym-2', SECRET);
    expect(a.sig).not.toBe(b.sig);
  });

  it('join and checkin QRs for the same gym produce different signatures', () => {
    const join = signQrPayload('join', GYM_ID, SECRET);
    const checkin = signQrPayload('checkin', GYM_ID, SECRET);
    expect(join.sig).not.toBe(checkin.sig);
  });
});

// ── v=2 rotating QR ───────────────────────────────────────────────────────────

describe('v=2 rotating checkin QR', () => {
  afterEach(() => vi.useRealTimers());

  it('round-trips a fresh rotating checkin QR', () => {
    const payload = signRotatingCheckinPayload(GYM_ID, SECRET);
    expect(verifyQrPayload(payload, 'checkin', SECRET)).toEqual({ gym_id: GYM_ID });
  });

  it('embeds a timestamp within the current second', () => {
    const before = Date.now();
    const payload = signRotatingCheckinPayload(GYM_ID, SECRET);
    const after = Date.now();
    expect(payload.ts).toBeGreaterThanOrEqual(before);
    expect(payload.ts).toBeLessThanOrEqual(after);
  });

  it('rejects an expired token (> 35 s old)', () => {
    vi.useFakeTimers();
    const payload = signRotatingCheckinPayload(GYM_ID, SECRET);
    vi.advanceTimersByTime(36_000);
    expect(() => verifyQrPayload(payload, 'checkin', SECRET)).toThrow('QR code expired');
  });

  it('accepts a token right at the 35 s boundary', () => {
    vi.useFakeTimers();
    const payload = signRotatingCheckinPayload(GYM_ID, SECRET);
    vi.advanceTimersByTime(34_999);
    expect(() => verifyQrPayload(payload, 'checkin', SECRET)).not.toThrow();
  });

  it('rejects a token with a future timestamp', () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now + 60_000);          // sign 60 s in the future
    const payload = signRotatingCheckinPayload(GYM_ID, SECRET);
    vi.setSystemTime(now);                   // verify at "now" → age = -60 s
    expect(() => verifyQrPayload(payload, 'checkin', SECRET)).toThrow();
  });

  it('rejects a tampered ts field', () => {
    const payload = signRotatingCheckinPayload(GYM_ID, SECRET);
    const tampered = { ...payload, ts: payload.ts - 5_000 };
    expect(() => verifyQrPayload(tampered, 'checkin', SECRET)).toThrow();
  });

  it('rejects a v=2 checkin payload presented as join', () => {
    const payload = signRotatingCheckinPayload(GYM_ID, SECRET);
    expect(() => verifyQrPayload(payload, 'join', SECRET)).toThrow();
  });

  it('rejects a v=2 payload with the wrong secret', () => {
    const payload = signRotatingCheckinPayload(GYM_ID, SECRET);
    expect(() => verifyQrPayload(payload, 'checkin', WRONG_SECRET)).toThrow();
  });
});
