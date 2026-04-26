import { query } from '../../db/client';
import type { DashboardStats, InactiveMember, TopVisitor, VisitTrendPoint } from './dashboard.types';

export async function getStats(gymId: string): Promise<DashboardStats> {
  const { rows } = await query<DashboardStats>(`
    SELECT
      (SELECT COUNT(*)::int FROM user_gyms WHERE gym_id = $1) AS total_members,
      (
        SELECT COUNT(*)::int FROM (
          SELECT user_id FROM check_ins
          WHERE gym_id = $1 AND checked_in_at >= NOW() - INTERVAL '7 days'
          GROUP BY user_id HAVING COUNT(*) >= 2
        ) t
      ) AS active_members,
      (
        SELECT COUNT(*)::int FROM (
          SELECT ug.user_id FROM user_gyms ug
          WHERE ug.gym_id = $1 AND ug.role = 'member'
            AND EXISTS (
              SELECT 1 FROM memberships m
              WHERE m.user_id = ug.user_id AND m.gym_id = $1
                AND m.start_date <= CURRENT_DATE AND m.end_date >= CURRENT_DATE
            )
            AND NOT EXISTS (
              SELECT 1 FROM check_ins ci
              WHERE ci.user_id = ug.user_id AND ci.gym_id = $1
                AND ci.checked_in_at >= NOW() - INTERVAL '14 days'
            )
        ) t
      ) AS inactive_members
  `, [gymId]);
  return rows[0];
}

export async function getInactiveMembers(gymId: string): Promise<InactiveMember[]> {
  const { rows } = await query<InactiveMember>(`
    SELECT u.id, u.full_name, u.email,
           (SELECT MAX(ci.checked_in_at)::text FROM check_ins ci
            WHERE ci.user_id = ug.user_id AND ci.gym_id = $1) AS last_visit
    FROM user_gyms ug
    JOIN users u ON u.id = ug.user_id
    WHERE ug.gym_id = $1 AND ug.role = 'member'
      AND EXISTS (
        SELECT 1 FROM memberships m
        WHERE m.user_id = ug.user_id AND m.gym_id = $1
          AND m.start_date <= CURRENT_DATE AND m.end_date >= CURRENT_DATE
      )
      AND NOT EXISTS (
        SELECT 1 FROM check_ins ci
        WHERE ci.user_id = ug.user_id AND ci.gym_id = $1
          AND ci.checked_in_at >= NOW() - INTERVAL '14 days'
      )
    ORDER BY last_visit ASC NULLS FIRST
  `, [gymId]);
  return rows;
}

export async function getTopVisitors(gymId: string): Promise<TopVisitor[]> {
  const { rows } = await query<TopVisitor>(`
    SELECT u.id, u.full_name, u.email, COUNT(ci.id)::int AS visit_count
    FROM check_ins ci
    JOIN users u ON u.id = ci.user_id
    WHERE ci.gym_id = $1 AND ci.checked_in_at >= NOW() - INTERVAL '30 days'
    GROUP BY u.id, u.full_name, u.email
    ORDER BY visit_count DESC
    LIMIT 5
  `, [gymId]);
  return rows;
}

export async function getVisitTrend(gymId: string): Promise<VisitTrendPoint[]> {
  const { rows } = await query<VisitTrendPoint>(`
    WITH dates AS (
      SELECT generate_series(
        CURRENT_DATE - INTERVAL '29 days',
        CURRENT_DATE,
        '1 day'::interval
      )::date AS date
    )
    SELECT d.date::text AS date, COALESCE(COUNT(ci.id), 0)::int AS visits
    FROM dates d
    LEFT JOIN check_ins ci
      ON DATE(ci.checked_in_at) = d.date AND ci.gym_id = $1
    GROUP BY d.date
    ORDER BY d.date
  `, [gymId]);
  return rows;
}
