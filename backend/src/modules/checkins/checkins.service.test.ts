import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../../lib/errors';
import { signQrPayload, signRotatingCheckinPayload } from '../../lib/qr';

vi.mock('../gyms/gyms.repository');
vi.mock('../memberships/memberships.repository');
vi.mock('./checkins.repository');
vi.mock('../rewards/rewards.service');

import { findById } from '../gyms/gyms.repository';
import { findActiveByUserAndGym } from '../memberships/memberships.repository';
import * as checkinsRepo from './checkins.repository';
import { evaluateRewards } from '../rewards/rewards.service';
import { checkIn } from './checkins.service';

const GYM_ID = 'gym-1';
const USER_ID = 'user-1';
const JOIN_SECRET = 'join-secret';
const CHECKIN_SECRET = 'checkin-secret';

const mockGym = {
  id: GYM_ID,
  name: 'Test Gym',
  slug: 'test',
  join_qr_secret: JOIN_SECRET,
  checkin_qr_secret: CHECKIN_SECRET,
  created_at: new Date(),
};

const mockMembership = {
  id: 'mem-1',
  user_id: USER_ID,
  gym_id: GYM_ID,
  start_date: '2025-01-01',
  end_date: '2026-01-01',
  created_by: 'admin-1',
  created_at: '2025-01-01',
};

const mockCheckIn = {
  id: 'ci-1',
  user_id: USER_ID,
  gym_id: GYM_ID,
  checked_in_at: new Date(),
};

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.useRealTimers());

describe('checkIn — happy paths', () => {
  it('succeeds with a valid v=1 checkin QR and active membership', async () => {
    vi.mocked(findById).mockResolvedValue(mockGym);
    vi.mocked(findActiveByUserAndGym).mockResolvedValue(mockMembership);
    vi.mocked(checkinsRepo.findRecentByUserAndGym).mockResolvedValue(null);
    vi.mocked(checkinsRepo.create).mockResolvedValue(mockCheckIn);
    vi.mocked(evaluateRewards).mockResolvedValue([]);

    const payload = signQrPayload('checkin', GYM_ID, CHECKIN_SECRET);
    const result = await checkIn(GYM_ID, USER_ID, payload, 'member');

    expect(result.id).toBe('ci-1');
    expect(result.new_rewards).toEqual([]);
    expect(checkinsRepo.create).toHaveBeenCalledWith(GYM_ID, USER_ID);
  });

  it('succeeds with a valid v=2 rotating checkin QR', async () => {
    vi.mocked(findById).mockResolvedValue(mockGym);
    vi.mocked(findActiveByUserAndGym).mockResolvedValue(mockMembership);
    vi.mocked(checkinsRepo.findRecentByUserAndGym).mockResolvedValue(null);
    vi.mocked(checkinsRepo.create).mockResolvedValue(mockCheckIn);
    vi.mocked(evaluateRewards).mockResolvedValue([]);

    const payload = signRotatingCheckinPayload(GYM_ID, CHECKIN_SECRET);
    const result = await checkIn(GYM_ID, USER_ID, payload, 'member');

    expect(result.id).toBe('ci-1');
  });

  it('returns new rewards earned during check-in', async () => {
    vi.mocked(findById).mockResolvedValue(mockGym);
    vi.mocked(findActiveByUserAndGym).mockResolvedValue(mockMembership);
    vi.mocked(checkinsRepo.findRecentByUserAndGym).mockResolvedValue(null);
    vi.mocked(checkinsRepo.create).mockResolvedValue(mockCheckIn);
    vi.mocked(evaluateRewards).mockResolvedValue([
      { description: '10% off next month', discount_percent: 10, type: 'milestone' },
    ]);

    const payload = signQrPayload('checkin', GYM_ID, CHECKIN_SECRET);
    const result = await checkIn(GYM_ID, USER_ID, payload, 'member');

    expect(result.new_rewards).toHaveLength(1);
    expect(result.new_rewards[0].description).toBe('10% off next month');
  });

  it('allows an admin to check in without an active membership', async () => {
    vi.mocked(findById).mockResolvedValue(mockGym);
    vi.mocked(checkinsRepo.findRecentByUserAndGym).mockResolvedValue(null);
    vi.mocked(checkinsRepo.create).mockResolvedValue(mockCheckIn);
    vi.mocked(evaluateRewards).mockResolvedValue([]);

    const payload = signQrPayload('checkin', GYM_ID, CHECKIN_SECRET);
    const result = await checkIn(GYM_ID, USER_ID, payload, 'admin');

    expect(result.id).toBe('ci-1');
    // Membership check is skipped — findActiveByUserAndGym should never be called
    expect(findActiveByUserAndGym).not.toHaveBeenCalled();
  });
});

describe('checkIn — QR validation failures', () => {
  it('throws ValidationError when a join QR is scanned at the check-in endpoint', async () => {
    vi.mocked(findById).mockResolvedValue(mockGym);

    const joinPayload = signQrPayload('join', GYM_ID, JOIN_SECRET);
    await expect(checkIn(GYM_ID, USER_ID, joinPayload, 'member')).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError when the QR signature is wrong', async () => {
    vi.mocked(findById).mockResolvedValue(mockGym);

    const payload = signQrPayload('checkin', GYM_ID, 'wrong-secret');
    await expect(checkIn(GYM_ID, USER_ID, payload, 'member')).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError when the QR belongs to a different gym', async () => {
    vi.mocked(findById).mockResolvedValue(mockGym); // gym-1's record

    // Valid QR for gym-2, signed with gym-1's secret — passes HMAC but gym_id mismatches
    const crossGymPayload = signQrPayload('checkin', 'gym-2', CHECKIN_SECRET);
    await expect(checkIn(GYM_ID, USER_ID, crossGymPayload, 'member')).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError when a v=2 QR has expired', async () => {
    vi.useFakeTimers();
    vi.mocked(findById).mockResolvedValue(mockGym);

    const payload = signRotatingCheckinPayload(GYM_ID, CHECKIN_SECRET);
    vi.advanceTimersByTime(36_000); // past the 35 s TTL

    await expect(checkIn(GYM_ID, USER_ID, payload, 'member')).rejects.toThrow(ValidationError);
  });

  it('throws NotFoundError when the gym does not exist', async () => {
    vi.mocked(findById).mockResolvedValue(null);

    const payload = signQrPayload('checkin', GYM_ID, CHECKIN_SECRET);
    await expect(checkIn(GYM_ID, USER_ID, payload, 'member')).rejects.toThrow(NotFoundError);
  });
});

describe('checkIn — business rule failures', () => {
  it('throws 403 AppError when the member has no active membership', async () => {
    vi.mocked(findById).mockResolvedValue(mockGym);
    vi.mocked(findActiveByUserAndGym).mockResolvedValue(null);

    const payload = signQrPayload('checkin', GYM_ID, CHECKIN_SECRET);
    await expect(checkIn(GYM_ID, USER_ID, payload, 'member')).rejects.toThrow(
      expect.objectContaining({ statusCode: 403 }),
    );
  });

  it('throws ConflictError on a duplicate check-in within 30 minutes', async () => {
    vi.mocked(findById).mockResolvedValue(mockGym);
    vi.mocked(findActiveByUserAndGym).mockResolvedValue(mockMembership);
    vi.mocked(checkinsRepo.findRecentByUserAndGym).mockResolvedValue(mockCheckIn); // recent exists

    const payload = signQrPayload('checkin', GYM_ID, CHECKIN_SECRET);
    await expect(checkIn(GYM_ID, USER_ID, payload, 'member')).rejects.toThrow(ConflictError);
    expect(checkinsRepo.create).not.toHaveBeenCalled();
  });
});

describe('checkIn — reward evaluation error handling', () => {
  it('swallows reward evaluation errors and still returns the check-in', async () => {
    vi.mocked(findById).mockResolvedValue(mockGym);
    vi.mocked(findActiveByUserAndGym).mockResolvedValue(mockMembership);
    vi.mocked(checkinsRepo.findRecentByUserAndGym).mockResolvedValue(null);
    vi.mocked(checkinsRepo.create).mockResolvedValue(mockCheckIn);
    vi.mocked(evaluateRewards).mockRejectedValue(new Error('DB connection lost'));

    const payload = signQrPayload('checkin', GYM_ID, CHECKIN_SECRET);
    const result = await checkIn(GYM_ID, USER_ID, payload, 'member');

    expect(result.id).toBe('ci-1');
    expect(result.new_rewards).toEqual([]);
  });
});

describe('checkIn — DB error propagation', () => {
  it('propagates repo.create errors — unlike rewards, a failed write is a real failure', async () => {
    vi.mocked(findById).mockResolvedValue(mockGym);
    vi.mocked(findActiveByUserAndGym).mockResolvedValue(mockMembership);
    vi.mocked(checkinsRepo.findRecentByUserAndGym).mockResolvedValue(null);
    vi.mocked(checkinsRepo.create).mockRejectedValue(new Error('DB write failed'));

    const payload = signQrPayload('checkin', GYM_ID, CHECKIN_SECRET);
    await expect(checkIn(GYM_ID, USER_ID, payload, 'member'))
      .rejects.toThrow('DB write failed');
  });

  it('propagates findRecentByUserAndGym errors before attempting to write', async () => {
    vi.mocked(findById).mockResolvedValue(mockGym);
    vi.mocked(findActiveByUserAndGym).mockResolvedValue(mockMembership);
    vi.mocked(checkinsRepo.findRecentByUserAndGym).mockRejectedValue(new Error('Dedup query failed'));

    const payload = signQrPayload('checkin', GYM_ID, CHECKIN_SECRET);
    await expect(checkIn(GYM_ID, USER_ID, payload, 'member'))
      .rejects.toThrow('Dedup query failed');

    expect(checkinsRepo.create).not.toHaveBeenCalled();
  });
});
