import { query } from '../../db/client';
import type { Gym } from './gyms.types';

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

export async function createUserGym(userId: string, gymId: string): Promise<void> {
  await query(
    `INSERT INTO user_gyms (user_id, gym_id, role) VALUES ($1, $2, 'member')
     ON CONFLICT (user_id, gym_id) DO NOTHING`,
    [userId, gymId],
  );
}
