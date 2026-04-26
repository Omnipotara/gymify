import { AppError, ConflictError, NotFoundError } from '../../lib/errors';
import { verifyQrPayload } from '../../lib/qr';
import { findById } from '../gyms/gyms.repository';
import { findActiveByUserAndGym } from '../memberships/memberships.repository';
import { evaluateRewards } from '../rewards/rewards.service';
import * as repo from './checkins.repository';
import type { CheckIn, CheckInResult } from './checkins.types';

const DEDUP_WINDOW_MINUTES = 30;

export async function checkIn(
  gymId: string,
  userId: string,
  rawPayload: unknown,
  userRole: 'member' | 'admin',
): Promise<CheckInResult> {
  const gym = await findById(gymId);
  if (!gym) throw new NotFoundError();

  // Verify QR signature
  try {
    const verified = verifyQrPayload(rawPayload, 'checkin', gym.checkin_qr_secret);
    if (verified.gym_id !== gymId) throw new Error('gym_id mismatch');
  } catch {
    const { ValidationError } = await import('../../lib/errors');
    throw new ValidationError('Invalid QR code');
  }

  // Admins have permanent access — skip membership check
  if (userRole !== 'admin') {
    const active = await findActiveByUserAndGym(gymId, userId);
    if (!active) throw new AppError('NO_ACTIVE_MEMBERSHIP', 'No active membership for this gym', 403);
  }

  // Dedup: reject if already checked in within the window
  const recent = await repo.findRecentByUserAndGym(gymId, userId, DEDUP_WINDOW_MINUTES);
  if (recent) {
    throw new ConflictError(`Already checked in within the last ${DEDUP_WINDOW_MINUTES} minutes`);
  }

  const checkInRecord = await repo.create(gymId, userId);
  let new_rewards: import('../rewards/rewards.types').RewardSummary[] = [];
  try {
    new_rewards = await evaluateRewards(gymId, userId);
  } catch {
    // Reward evaluation errors must not fail the check-in
  }
  return { ...checkInRecord, new_rewards };
}

export async function getHistory(
  gymId: string,
  userId: string,
  limit = 20,
  before?: string,
): Promise<{ items: CheckIn[]; next_cursor: string | null }> {
  const items = await repo.findByUserAndGym(gymId, userId, limit + 1, before);
  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  const next_cursor =
    hasMore ? page[page.length - 1].checked_in_at.toISOString() : null;
  return { items: page, next_cursor };
}
