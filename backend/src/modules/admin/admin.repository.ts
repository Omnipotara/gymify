import { query } from '../../db/client';
import type { AdminGym, AdminUser, GymAdmin, PlatformStats } from './admin.types';

export async function getPlatformStats(): Promise<PlatformStats> {
  const [gyms, users, checkinsToday, checkinsTotal, activeMembers, newUsers] = await Promise.all([
    query<{ count: number }>('SELECT COUNT(*)::int AS count FROM gyms'),
    query<{ count: number }>('SELECT COUNT(*)::int AS count FROM users'),
    query<{ count: number }>('SELECT COUNT(*)::int AS count FROM check_ins WHERE checked_in_at >= CURRENT_DATE'),
    query<{ count: number }>('SELECT COUNT(*)::int AS count FROM check_ins'),
    query<{ count: number }>(
      `SELECT COUNT(DISTINCT user_id)::int AS count FROM memberships
       WHERE start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE`,
    ),
    query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM users
       WHERE created_at >= NOW() - INTERVAL '7 days'`,
    ),
  ]);
  return {
    gym_count: gyms.rows[0].count,
    user_count: users.rows[0].count,
    checkins_today: checkinsToday.rows[0].count,
    checkins_total: checkinsTotal.rows[0].count,
    active_members: activeMembers.rows[0].count,
    new_users_this_week: newUsers.rows[0].count,
  };
}

export async function getAllGyms(): Promise<AdminGym[]> {
  const { rows } = await query<AdminGym>(
    `SELECT g.id, g.name, g.slug, g.created_at::text,
            COUNT(ug.user_id)::int AS member_count
     FROM gyms g
     LEFT JOIN user_gyms ug ON ug.gym_id = g.id
     GROUP BY g.id
     ORDER BY g.created_at DESC`,
  );
  return rows;
}

export async function createGym(
  name: string,
  slug: string,
  joinQrSecret: string,
  checkinQrSecret: string,
): Promise<{ id: string; name: string; slug: string }> {
  const { rows } = await query<{ id: string; name: string; slug: string }>(
    `INSERT INTO gyms (name, slug, join_qr_secret, checkin_qr_secret)
     VALUES ($1, $2, $3, $4) RETURNING id, name, slug`,
    [name, slug, joinQrSecret, checkinQrSecret],
  );
  return rows[0];
}

export async function gymSlugExists(slug: string): Promise<boolean> {
  const { rows } = await query<{ exists: boolean }>(
    'SELECT EXISTS(SELECT 1 FROM gyms WHERE slug = $1) AS exists',
    [slug],
  );
  return rows[0].exists;
}

export async function deleteGym(gymId: string): Promise<boolean> {
  const { rowCount } = await query('DELETE FROM gyms WHERE id = $1', [gymId]);
  return (rowCount ?? 0) > 0;
}

export async function getAllUsers(): Promise<AdminUser[]> {
  const { rows } = await query<AdminUser>(
    `SELECT u.id, u.email, u.full_name, u.is_super_admin, u.created_at::text,
            COALESCE(
              json_agg(
                json_build_object('gym_id', ug.gym_id, 'gym_name', g.name, 'role', ug.role)
                ORDER BY g.name
              ) FILTER (WHERE ug.gym_id IS NOT NULL),
              '[]'
            ) AS gyms
     FROM users u
     LEFT JOIN user_gyms ug ON ug.user_id = u.id
     LEFT JOIN gyms g ON g.id = ug.gym_id
     GROUP BY u.id
     ORDER BY u.created_at DESC`,
  );
  return rows;
}

export async function findUserByEmail(email: string): Promise<{ id: string; email: string; full_name: string | null } | null> {
  const { rows } = await query<{ id: string; email: string; full_name: string | null }>(
    `SELECT id, email, full_name FROM users WHERE email = $1`,
    [email.toLowerCase()],
  );
  return rows[0] ?? null;
}

export async function findGymById(gymId: string): Promise<{ id: string; name: string } | null> {
  const { rows } = await query<{ id: string; name: string }>(
    `SELECT id, name FROM gyms WHERE id = $1`,
    [gymId],
  );
  return rows[0] ?? null;
}

export async function getGymAdmins(gymId: string): Promise<GymAdmin[]> {
  const { rows } = await query<GymAdmin>(
    `SELECT u.id, u.email, u.full_name
     FROM user_gyms ug
     JOIN users u ON u.id = ug.user_id
     WHERE ug.gym_id = $1 AND ug.role = 'admin'
     ORDER BY u.full_name, u.email`,
    [gymId],
  );
  return rows;
}

export async function addGymAdmin(gymId: string, userId: string): Promise<void> {
  await query(
    `INSERT INTO user_gyms (user_id, gym_id, role) VALUES ($1, $2, 'admin')
     ON CONFLICT (user_id, gym_id) DO UPDATE SET role = 'admin'`,
    [userId, gymId],
  );
}

export async function removeGymAdmin(gymId: string, userId: string): Promise<boolean> {
  const { rowCount } = await query(
    `DELETE FROM user_gyms WHERE gym_id = $1 AND user_id = $2 AND role = 'admin'`,
    [gymId, userId],
  );
  return (rowCount ?? 0) > 0;
}

export async function setGymMemberRole(
  gymId: string,
  userId: string,
  role: 'admin' | 'member',
): Promise<void> {
  await query(
    `INSERT INTO user_gyms (user_id, gym_id, role) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, gym_id) DO UPDATE SET role = $3`,
    [userId, gymId, role],
  );
}
