import { ConflictError, NotFoundError } from '../../lib/errors';
import { verifyQrPayload } from '../../lib/qr';
import { findById } from '../gyms/gyms.repository';
import * as repo from './checkins.repository';
import type { CheckIn } from './checkins.types';

const DEDUP_WINDOW_MINUTES = 30;

export async function checkIn(
  gymId: string,
  userId: string,
  rawPayload: unknown,
): Promise<CheckIn> {
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

  // Dedup: reject if already checked in within the window
  const recent = await repo.findRecentByUserAndGym(gymId, userId, DEDUP_WINDOW_MINUTES);
  if (recent) {
    throw new ConflictError(`Already checked in within the last ${DEDUP_WINDOW_MINUTES} minutes`);
  }

  return repo.create(gymId, userId);
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
