import { query } from '../../db/client';
import { encryptField, decryptField } from '../../lib/crypto';
import type { MeResponse, GymSummary } from './users.types';

export async function findById(id: string): Promise<MeResponse | null> {
  const { rows } = await query<MeResponse>(
    'SELECT id, email, full_name, phone, is_super_admin FROM users WHERE id = $1',
    [id],
  );
  if (!rows[0]) return null;
  return { ...rows[0], phone: decryptField(rows[0].phone) };
}

export async function updateProfile(
  id: string,
  patch: { full_name?: string | null; phone?: string | null },
): Promise<MeResponse | null> {
  const setClauses: string[] = [];
  const values: unknown[] = [id];
  let idx = 2;
  if ('full_name' in patch) { setClauses.push(`full_name = $${idx++}`); values.push(patch.full_name ?? null); }
  if ('phone' in patch) { setClauses.push(`phone = $${idx++}`); values.push(encryptField(patch.phone)); }
  if (setClauses.length === 0) return findById(id);

  const { rows } = await query<MeResponse>(
    `UPDATE users SET ${setClauses.join(', ')}
     WHERE id = $1
     RETURNING id, email, full_name, phone, is_super_admin`,
    values,
  );
  if (!rows[0]) return null;
  return { ...rows[0], phone: decryptField(rows[0].phone) };
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
