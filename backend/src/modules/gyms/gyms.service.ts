import { NotFoundError } from '../../lib/errors';
import { verifyQrPayload, signQrPayload, signRotatingCheckinPayload } from '../../lib/qr';
import { computeMembershipStatus } from '../../lib/membership-status';
import * as repo from './gyms.repository';
import type { JoinResponse, MemberWithStatus, QrPayloadResponse, RotatingQrPayloadResponse } from './gyms.types';

export async function getMembers(gymId: string): Promise<MemberWithStatus[]> {
  const rows = await repo.getMembers(gymId);
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    full_name: r.full_name,
    role: r.role,
    joined_at: r.joined_at,
    membership: {
      id: r.membership_id,
      status: computeMembershipStatus(
        r.membership_start_date && r.membership_end_date
          ? { start_date: r.membership_start_date, end_date: r.membership_end_date }
          : null,
      ),
      start_date: r.membership_start_date,
      end_date: r.membership_end_date,
    },
  }));
}

export async function getJoinQrPayload(gymId: string): Promise<QrPayloadResponse> {
  const gym = await repo.findById(gymId);
  if (!gym) throw new NotFoundError();
  const payload = signQrPayload('join', gymId, gym.join_qr_secret);
  return { payload: payload as unknown as Record<string, unknown> };
}

export async function getCheckinQrPayload(gymId: string): Promise<RotatingQrPayloadResponse> {
  const gym = await repo.findById(gymId);
  if (!gym) throw new NotFoundError();
  const payload = signRotatingCheckinPayload(gymId, gym.checkin_qr_secret);
  return {
    payload: payload as unknown as Record<string, unknown>,
    expires_at: payload.ts + 30_000,
  };
}

export async function joinGym(userId: string, rawPayload: unknown): Promise<JoinResponse> {
  // Parse gym_id from payload to look up the gym
  const payloadObj = rawPayload as Record<string, unknown>;
  const gymId = typeof payloadObj?.gym_id === 'string' ? payloadObj.gym_id : null;
  if (!gymId) throw new NotFoundError();

  const gym = await repo.findById(gymId);
  if (!gym) throw new NotFoundError();

  // Verify the QR signature — throws on any failure
  try {
    verifyQrPayload(rawPayload, 'join', gym.join_qr_secret);
  } catch {
    // Generic 400; never reveal why it failed
    const { ValidationError } = await import('../../lib/errors');
    throw new ValidationError('Invalid QR code');
  }

  // Idempotent — if already a member, return success
  await repo.createUserGym(userId, gym.id);

  return {
    gym: { id: gym.id, name: gym.name, slug: gym.slug, role: 'member' },
  };
}
