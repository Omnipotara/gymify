import { query } from '../../db/client';
import { encryptField } from '../../lib/crypto';
import type { DbUser } from './auth.types';

const USER_COLS = 'id, email, password_hash, full_name, is_super_admin, phone';

export async function findUserByEmail(email: string): Promise<DbUser | null> {
  const { rows } = await query<DbUser>(
    `SELECT ${USER_COLS} FROM users WHERE email = $1`,
    [email.toLowerCase()],
  );
  return rows[0] ?? null;
}

/** Returns true if the user is an admin of any gym (used to set lockout threshold). */
export async function isUserAdmin(userId: string): Promise<boolean> {
  const { rows } = await query<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM user_gyms WHERE user_id = $1 AND role = 'admin') AS exists`,
    [userId],
  );
  return rows[0]?.exists ?? false;
}

export async function createUser(data: {
  email: string;
  passwordHash: string;
  fullName?: string;
  phone?: string;
}): Promise<DbUser> {
  const { rows } = await query<DbUser>(
    `INSERT INTO users (email, password_hash, full_name, phone)
     VALUES ($1, $2, $3, $4)
     RETURNING ${USER_COLS}`,
    [data.email.toLowerCase(), data.passwordHash, data.fullName ?? null, encryptField(data.phone)],
  );
  return rows[0];
}
