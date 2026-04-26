import { query } from '../../db/client';
import type { Gym, MemberWithStatus } from './gyms.types';

type MemberRow = Omit<MemberWithStatus, 'membership'> & {
  membership_id: string | null;
  membership_start_date: string | null;
  membership_end_date: string | null;
};

export async function findById(gymId: string): Promise<Gym | null> {
  const { rows } = await query<Gym>(
    'SELECT id, name, slug, join_qr_secret, checkin_qr_secret, created_at FROM gyms WHERE id = $1',
    [gymId],
  );
  return rows[0] ?? null;
}

export async function findUserGym(
  userId: string,
  gymId: string,
): Promise<{ role: string } | null> {
  const { rows } = await query<{ role: string }>(
    'SELECT role FROM user_gyms WHERE user_id = $1 AND gym_id = $2',
    [userId, gymId],
  );
  return rows[0] ?? null;
}

export async function getMembers(gymId: string): Promise<MemberRow[]> {
  const { rows } = await query<MemberRow>(
    `SELECT u.id, u.email, u.full_name, ug.role, ug.joined_at::text,
            latest.id               AS membership_id,
            latest.start_date::text AS membership_start_date,
            latest.end_date::text   AS membership_end_date
     FROM user_gyms ug
     JOIN users u ON u.id = ug.user_id
     LEFT JOIN LATERAL (
       SELECT id, start_date, end_date
       FROM memberships
       WHERE user_id = ug.user_id AND gym_id = ug.gym_id
       ORDER BY end_date DESC
       LIMIT 1
     ) latest ON true
     WHERE ug.gym_id = $1
     ORDER BY u.full_name NULLS LAST, u.email`,
    [gymId],
  );
  return rows;
}

export async function createUserGym(userId: string, gymId: string): Promise<void> {
  await query(
    `INSERT INTO user_gyms (user_id, gym_id, role) VALUES ($1, $2, 'member')
     ON CONFLICT (user_id, gym_id) DO NOTHING`,
    [userId, gymId],
  );
}
