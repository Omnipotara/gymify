import { query } from '../../db/client';
import type { MeResponse, GymSummary } from './users.types';

export async function findById(id: string): Promise<MeResponse | null> {
  const { rows } = await query<MeResponse>(
    'SELECT id, email, full_name, is_super_admin FROM users WHERE id = $1',
    [id],
  );
  return rows[0] ?? null;
}

export async function findGymsByUserId(userId: string): Promise<GymSummary[]> {
  const { rows } = await query<GymSummary>(
    `SELECT g.id, g.name, g.slug, ug.role
     FROM user_gyms ug
     JOIN gyms g ON g.id = ug.gym_id
     WHERE ug.user_id = $1
     ORDER BY ug.joined_at`,
    [userId],
  );
  return rows;
}
