import { query } from '../../db/client';
import type { Membership } from './memberships.types';

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

export async function updateEndDate(
  gymId: string,
  membershipId: string,
  endDate: string,
): Promise<Membership | null> {
  const { rows } = await query<Membership>(
    `UPDATE memberships SET end_date = $1
     WHERE id = $2 AND gym_id = $3
     RETURNING ${COLS}`,
    [endDate, membershipId, gymId],
  );
  return rows[0] ?? null;
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
