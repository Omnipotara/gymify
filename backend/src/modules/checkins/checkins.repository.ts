import { query } from '../../db/client';
import type { CheckIn } from './checkins.types';

export async function findRecentByUserAndGym(
  gymId: string,
  userId: string,
  windowMinutes: number,
): Promise<CheckIn | null> {
  const { rows } = await query<CheckIn>(
    `SELECT id, user_id, gym_id, checked_in_at
     FROM check_ins
     WHERE gym_id = $1
       AND user_id = $2
       AND checked_in_at > NOW() - ($3 || ' minutes')::interval
     LIMIT 1`,
    [gymId, userId, windowMinutes],
  );
  return rows[0] ?? null;
}

export async function create(gymId: string, userId: string): Promise<CheckIn> {
  const { rows } = await query<CheckIn>(
    `INSERT INTO check_ins (user_id, gym_id)
     VALUES ($1, $2)
     RETURNING id, user_id, gym_id, checked_in_at`,
    [userId, gymId],
  );
  return rows[0];
}

export interface CheckInLogEntry {
  id: string;
  user_id: string;
  checked_in_at: Date;
  member_name: string | null;
  member_email: string;
}

export async function findRecentForGym(gymId: string, limit: number): Promise<CheckInLogEntry[]> {
  const { rows } = await query<CheckInLogEntry>(
    `SELECT ci.id, ci.user_id, ci.checked_in_at, u.full_name AS member_name, u.email AS member_email
     FROM check_ins ci
     JOIN users u ON u.id = ci.user_id
     WHERE ci.gym_id = $1
     ORDER BY ci.checked_in_at DESC
     LIMIT $2`,
    [gymId, limit],
  );
  return rows;
}

export async function findByUserAndGym(
  gymId: string,
  userId: string,
  limit: number,
  before?: string,
): Promise<CheckIn[]> {
  const { rows } = await query<CheckIn>(
    `SELECT id, user_id, gym_id, checked_in_at
     FROM check_ins
     WHERE gym_id = $1
       AND user_id = $2
       ${before ? 'AND checked_in_at < $4' : ''}
     ORDER BY checked_in_at DESC
     LIMIT $3`,
    before ? [gymId, userId, limit, before] : [gymId, userId, limit],
  );
  return rows;
}
