import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError } from '../../lib/errors';

vi.mock('./admin.repository');
vi.mock('../../lib/email');
vi.mock('crypto', async () => {
  const actual = await vi.importActual<typeof import('crypto')>('crypto');
  return { ...actual, randomBytes: vi.fn(() => Buffer.from('abcdef', 'hex')) };
});

import * as repo from './admin.repository';
import * as emailLib from '../../lib/email';
import { getGymAdmins, addGymAdmin, removeGymAdmin } from './admin.service';
import type { GymAdmin } from './admin.types';

const MOCK_USER = { id: 'user-1', email: 'owner@test.com', full_name: 'Gym Owner' };
const MOCK_GYM  = { id: 'gym-1', name: 'Iron Paradise' };
const MOCK_ADMIN: GymAdmin = { id: 'user-1', email: 'owner@test.com', full_name: 'Gym Owner' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(emailLib.sendGymAdminNotificationEmail).mockResolvedValue(undefined);
});

// ── getGymAdmins ──────────────────────────────────────────────────────────────

describe('getGymAdmins', () => {
  it('returns the list from the repository', async () => {
    vi.mocked(repo.getGymAdmins).mockResolvedValue([MOCK_ADMIN]);

    const result = await getGymAdmins('gym-1');

    expect(result).toEqual([MOCK_ADMIN]);
    expect(repo.getGymAdmins).toHaveBeenCalledWith('gym-1');
  });

  it('returns an empty array when the gym has no admins', async () => {
    vi.mocked(repo.getGymAdmins).mockResolvedValue([]);

    const result = await getGymAdmins('gym-1');

    expect(result).toEqual([]);
  });
});

// ── addGymAdmin ───────────────────────────────────────────────────────────────

describe('addGymAdmin', () => {
  it('looks up user and gym, upserts admin role, then sends notification email', async () => {
    vi.mocked(repo.findUserByEmail).mockResolvedValue(MOCK_USER);
    vi.mocked(repo.findGymById).mockResolvedValue(MOCK_GYM);
    vi.mocked(repo.addGymAdmin).mockResolvedValue(undefined);

    await addGymAdmin('gym-1', 'owner@test.com');

    expect(repo.findUserByEmail).toHaveBeenCalledWith('owner@test.com');
    expect(repo.findGymById).toHaveBeenCalledWith('gym-1');
    expect(repo.addGymAdmin).toHaveBeenCalledWith('gym-1', 'user-1');
    expect(emailLib.sendGymAdminNotificationEmail).toHaveBeenCalledWith('owner@test.com', 'Iron Paradise');
  });

  it('throws NotFoundError when no user exists with that email', async () => {
    vi.mocked(repo.findUserByEmail).mockResolvedValue(null);
    vi.mocked(repo.findGymById).mockResolvedValue(MOCK_GYM);

    await expect(addGymAdmin('gym-1', 'nobody@test.com')).rejects.toThrow(NotFoundError);
    expect(repo.addGymAdmin).not.toHaveBeenCalled();
    expect(emailLib.sendGymAdminNotificationEmail).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when the gym does not exist', async () => {
    vi.mocked(repo.findUserByEmail).mockResolvedValue(MOCK_USER);
    vi.mocked(repo.findGymById).mockResolvedValue(null);

    await expect(addGymAdmin('bad-gym', 'owner@test.com')).rejects.toThrow(NotFoundError);
    expect(repo.addGymAdmin).not.toHaveBeenCalled();
    expect(emailLib.sendGymAdminNotificationEmail).not.toHaveBeenCalled();
  });

  it('sends the correct gym name in the notification email', async () => {
    vi.mocked(repo.findUserByEmail).mockResolvedValue(MOCK_USER);
    vi.mocked(repo.findGymById).mockResolvedValue({ id: 'gym-1', name: 'Powerhouse Gym' });
    vi.mocked(repo.addGymAdmin).mockResolvedValue(undefined);

    await addGymAdmin('gym-1', 'owner@test.com');

    expect(emailLib.sendGymAdminNotificationEmail).toHaveBeenCalledWith(
      'owner@test.com',
      'Powerhouse Gym',
    );
  });
});

// ── removeGymAdmin ────────────────────────────────────────────────────────────

describe('removeGymAdmin', () => {
  it('removes the user from the gym and resolves successfully', async () => {
    vi.mocked(repo.removeGymAdmin).mockResolvedValue(true);

    await expect(removeGymAdmin('gym-1', 'user-1')).resolves.toBeUndefined();
    expect(repo.removeGymAdmin).toHaveBeenCalledWith('gym-1', 'user-1');
  });

  it('throws NotFoundError when the user is not an admin of that gym', async () => {
    vi.mocked(repo.removeGymAdmin).mockResolvedValue(false);

    await expect(removeGymAdmin('gym-1', 'user-99')).rejects.toThrow(NotFoundError);
  });
});
