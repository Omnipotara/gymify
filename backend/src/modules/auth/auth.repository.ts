import { query } from '../../db/client';
import type { DbUser } from './auth.types';

const USER_COLS = 'id, email, password_hash, full_name, is_super_admin';

export async function findUserByEmail(email: string): Promise<DbUser | null> {
  const { rows } = await query<DbUser>(
    `SELECT ${USER_COLS} FROM users WHERE email = $1`,
    [email.toLowerCase()],
  );
  return rows[0] ?? null;
}

export async function createUser(data: {
  email: string;
  passwordHash: string;
  fullName?: string;
}): Promise<DbUser> {
  const { rows } = await query<DbUser>(
    `INSERT INTO users (email, password_hash, full_name)
     VALUES ($1, $2, $3)
     RETURNING ${USER_COLS}`,
    [data.email.toLowerCase(), data.passwordHash, data.fullName ?? null],
  );
  return rows[0];
}
