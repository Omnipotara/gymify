import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, ValidationError } from '../../lib/errors';
import { signQrPayload } from '../../lib/qr';

vi.mock('./gyms.repository');

import * as repo from './gyms.repository';
import { joinGym } from './gyms.service';

const JOIN_SECRET = 'join-secret';
const CHECKIN_SECRET = 'checkin-secret';

const mockGym = {
  id: 'gym-1',
  name: 'Iron Paradise',
  slug: 'iron-paradise',
  join_qr_secret: JOIN_SECRET,
  checkin_qr_secret: CHECKIN_SECRET,
  created_at: new Date(),
};

beforeEach(() => vi.clearAllMocks());

describe('joinGym', () => {
  it('joins successfully with a valid join QR', async () => {
    vi.mocked(repo.findById).mockResolvedValue(mockGym);
    vi.mocked(repo.createUserGym).mockResolvedValue(undefined);

    const payload = signQrPayload('join', 'gym-1', JOIN_SECRET);
    const result = await joinGym('user-1', payload);

    expect(result.gym.id).toBe('gym-1');
    expect(result.gym.role).toBe('member');
    expect(repo.createUserGym).toHaveBeenCalledWith('user-1', 'gym-1');
  });

  it('returns gym name and slug from the database record', async () => {
    vi.mocked(repo.findById).mockResolvedValue(mockGym);
    vi.mocked(repo.createUserGym).mockResolvedValue(undefined);

    const payload = signQrPayload('join', 'gym-1', JOIN_SECRET);
    const result = await joinGym('user-1', payload);

    expect(result.gym.name).toBe('Iron Paradise');
    expect(result.gym.slug).toBe('iron-paradise');
  });

  it('throws NotFoundError when the payload has no gym_id', async () => {
    await expect(joinGym('user-1', { type: 'join' })).rejects.toThrow(NotFoundError);
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when the gym does not exist', async () => {
    vi.mocked(repo.findById).mockResolvedValue(null);

    const payload = signQrPayload('join', 'gym-1', JOIN_SECRET);
    await expect(joinGym('user-1', payload)).rejects.toThrow(NotFoundError);
  });

  it('throws ValidationError when a checkin QR is used at the join endpoint', async () => {
    vi.mocked(repo.findById).mockResolvedValue(mockGym);

    // Correctly signed checkin QR — wrong type for joining
    const payload = signQrPayload('checkin', 'gym-1', CHECKIN_SECRET);
    await expect(joinGym('user-1', payload)).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError when the QR signature is wrong', async () => {
    vi.mocked(repo.findById).mockResolvedValue(mockGym);

    const payload = signQrPayload('join', 'gym-1', 'some-other-secret');
    await expect(joinGym('user-1', payload)).rejects.toThrow(ValidationError);
  });

  it('is idempotent — joining twice succeeds and calls createUserGym both times', async () => {
    vi.mocked(repo.findById).mockResolvedValue(mockGym);
    vi.mocked(repo.createUserGym).mockResolvedValue(undefined);

    const payload = signQrPayload('join', 'gym-1', JOIN_SECRET);
    await joinGym('user-1', payload);
    await joinGym('user-1', payload);

    expect(repo.createUserGym).toHaveBeenCalledTimes(2);
  });
});

// ── joinGym — payload shape edge cases ────────────────────────────────────────

describe('joinGym — payload shape edge cases', () => {
  it('throws NotFoundError when payload is null', async () => {
    await expect(joinGym('user-1', null)).rejects.toThrow(NotFoundError);
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when payload is a plain string', async () => {
    await expect(joinGym('user-1', 'not-an-object')).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError when gym_id is a number instead of a string', async () => {
    await expect(joinGym('user-1', { gym_id: 12345, type: 'join' })).rejects.toThrow(NotFoundError);
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it('propagates createUserGym errors (e.g. DB constraint violation)', async () => {
    vi.mocked(repo.findById).mockResolvedValue(mockGym);
    vi.mocked(repo.createUserGym).mockRejectedValue(new Error('unique constraint violation'));

    const payload = signQrPayload('join', 'gym-1', JOIN_SECRET);
    await expect(joinGym('user-1', payload)).rejects.toThrow('unique constraint violation');
  });
});
