import { query } from '../../db/client';
import { encryptField } from '../../lib/crypto';
import type { DbUser, DbResetToken } from './auth.types';

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

export async function updateUserPassword(userId: string, passwordHash: string): Promise<void> {
  await query(
    `UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`,
    [passwordHash, userId],
  );
}

export async function invalidateResetTokens(userId: string): Promise<void> {
  await query(
    `DELETE FROM password_reset_tokens WHERE user_id = $1`,
    [userId],
  );
}

export async function createResetToken(data: {
  userId: string;
  codeHash: string;
  expiresAt: Date;
}): Promise<void> {
  await query(
    `INSERT INTO password_reset_tokens (user_id, code_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [data.userId, data.codeHash, data.expiresAt],
  );
}

export async function findValidResetToken(userId: string): Promise<DbResetToken | null> {
  const { rows } = await query<DbResetToken>(
    `SELECT id, user_id, code_hash, expires_at, used_at
     FROM password_reset_tokens
     WHERE user_id = $1 AND used_at IS NULL AND expires_at > now()
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId],
  );
  return rows[0] ?? null;
}

export async function markResetTokenUsed(id: number): Promise<void> {
  await query(
    `UPDATE password_reset_tokens SET used_at = now() WHERE id = $1`,
    [id],
  );
}
