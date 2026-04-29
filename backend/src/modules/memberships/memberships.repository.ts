import { query } from '../../db/client';
import { decryptField } from '../../lib/crypto';
import type { Membership, WeeklyVisit } from './memberships.types';

const COLS = 'id, user_id, gym_id, start_date::text, end_date::text, created_by, created_at::text';

/**
 * Returns the most relevant membership for status display:
 * 1. Currently active (today between start and end)
 * 2. Most recently expired
 * 3. Future (not yet started) — only if nothing else exists
 *
 * Sorting by end_date DESC alone breaks when a future membership has a
 * later end_date than a currently active one — it would shadow the active
 * record and return status 'none'.
 */
export async function findLatestByUserAndGym(
  gymId: string,
  userId: string,
): Promise<Membership | null> {
  const { rows } = await query<Membership>(
    `SELECT ${COLS} FROM memberships
     WHERE gym_id = $1 AND user_id = $2
     ORDER BY
       CASE
         WHEN start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE THEN 0
         WHEN end_date < CURRENT_DATE THEN 1
         ELSE 2
       END,
       end_date DESC
     LIMIT 1`,
    [gymId, userId],
  );
  return rows[0] ?? null;
}

/** Returns truthy if the user has a currently active membership. Used for check-in gate. */
export async function findActiveByUserAndGym(
  gymId: string,
  userId: string,
): Promise<Membership | null> {
  const { rows } = await query<Membership>(
    `SELECT ${COLS} FROM memberships
     WHERE gym_id = $1 AND user_id = $2
       AND start_date <= CURRENT_DATE
       AND end_date >= CURRENT_DATE
     LIMIT 1`,
    [gymId, userId],
  );
  return rows[0] ?? null;
}

/** Ends all memberships that haven't expired yet (active + future) for a user at a gym. */
export async function endAllNonExpired(gymId: string, userId: string): Promise<void> {
  await query(
    `UPDATE memberships
     SET end_date = CURRENT_DATE - INTERVAL '1 day'
     WHERE gym_id = $1 AND user_id = $2 AND end_date >= CURRENT_DATE`,
    [gymId, userId],
  );
}

export async function updateDates(
  gymId: string,
  membershipId: string,
  startDate: string,
  endDate: string,
): Promise<Membership | null> {
  const { rows } = await query<Membership>(
    `UPDATE memberships SET start_date = $1, end_date = $2
     WHERE id = $3 AND gym_id = $4
     RETURNING ${COLS}`,
    [startDate, endDate, membershipId, gymId],
  );
  return rows[0] ?? null;
}

interface StatsRow {
  total_visits: number;
  visits_last_30_days: number;
  visits_this_week: number;
  days_until_expiry: number | null;
  member_since: string;
}

export async function getMemberStats(gymId: string, userId: string): Promise<StatsRow> {
  const { rows } = await query<StatsRow>(`
    SELECT
      (SELECT COUNT(*)::int FROM check_ins
       WHERE gym_id = $1 AND user_id = $2) AS total_visits,
      (SELECT COUNT(*)::int FROM check_ins
       WHERE gym_id = $1 AND user_id = $2
         AND checked_in_at >= NOW() - INTERVAL '30 days') AS visits_last_30_days,
      (SELECT COUNT(*)::int FROM check_ins
       WHERE gym_id = $1 AND user_id = $2
         AND checked_in_at >= NOW() - INTERVAL '7 days') AS visits_this_week,
      (SELECT (end_date - CURRENT_DATE)::int FROM memberships
       WHERE gym_id = $1 AND user_id = $2
         AND start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE
       ORDER BY end_date DESC LIMIT 1) AS days_until_expiry,
      (SELECT joined_at::text FROM user_gyms
       WHERE gym_id = $1 AND user_id = $2) AS member_since
  `, [gymId, userId]);
  return rows[0];
}

export async function getWeeklyTrend(gymId: string, userId: string): Promise<WeeklyVisit[]> {
  const { rows } = await query<WeeklyVisit>(`
    WITH weeks AS (SELECT generate_series(0, 3) AS week_offset),
    counts AS (
      SELECT
        CASE
          WHEN checked_in_at >= NOW() - INTERVAL '7 days'  THEN 0
          WHEN checked_in_at >= NOW() - INTERVAL '14 days' THEN 1
          WHEN checked_in_at >= NOW() - INTERVAL '21 days' THEN 2
          ELSE 3
        END AS week_offset,
        COUNT(*)::int AS visits
      FROM check_ins
      WHERE gym_id = $1 AND user_id = $2
        AND checked_in_at >= NOW() - INTERVAL '28 days'
      GROUP BY 1
    )
    SELECT w.week_offset, COALESCE(c.visits, 0) AS visits
    FROM weeks w
    LEFT JOIN counts c ON c.week_offset = w.week_offset
    ORDER BY w.week_offset
  `, [gymId, userId]);
  return rows;
}

export async function findMemberInfo(
  gymId: string,
  userId: string,
): Promise<{ id: string; email: string; full_name: string | null; phone: string | null; role: string; joined_at: string } | null> {
  const { rows } = await query<{ id: string; email: string; full_name: string | null; phone: string | null; role: string; joined_at: string }>(
    `SELECT u.id, u.email, u.full_name, u.phone, ug.role, ug.joined_at::text
     FROM users u
     JOIN user_gyms ug ON ug.user_id = u.id AND ug.gym_id = $1
     WHERE u.id = $2`,
    [gymId, userId],
  );
  if (!rows[0]) return null;
  return { ...rows[0], phone: decryptField(rows[0].phone) };
}

export async function create(data: {
  gymId: string;
  userId: string;
  startDate: string;
  endDate: string;
  createdBy: string;
}): Promise<Membership> {
  const { rows } = await query<Membership>(
    `INSERT INTO memberships (user_id, gym_id, start_date, end_date, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${COLS}`,
    [data.userId, data.gymId, data.startDate, data.endDate, data.createdBy],
  );
  return rows[0];
}
