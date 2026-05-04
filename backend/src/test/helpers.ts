import crypto from 'crypto';
import argon2 from 'argon2';
import request from 'supertest';
import app from '../app';
import { query } from '../db/client';
import { encryptSecret } from '../lib/crypto';
import { signQrPayload, signRotatingCheckinPayload } from '../lib/qr';

/** Wipe all rows from every table. Call in beforeEach to isolate tests. */
export async function truncateAll(): Promise<void> {
  await query(
    `TRUNCATE users, gyms, user_gyms, memberships, check_ins, reward_rules, member_rewards,
              password_reset_tokens
     RESTART IDENTITY CASCADE`,
  );
}

export interface TestGym {
  id: string;
  name: string;
  slug: string;
  joinSecret: string;
  checkinSecret: string;
}

/** Insert a gym row directly, bypassing the super-admin API. */
export async function createTestGym(name = 'Test Gym'): Promise<TestGym> {
  const slug = `${name.toLowerCase().replace(/\s+/g, '-')}-${crypto.randomBytes(4).toString('hex')}`;
  const joinSecret = crypto.randomBytes(16).toString('hex');
  const checkinSecret = crypto.randomBytes(16).toString('hex');
  const { rows } = await query<{ id: string }>(
    `INSERT INTO gyms (name, slug, join_qr_secret, checkin_qr_secret)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [name, slug, encryptSecret(joinSecret), encryptSecret(checkinSecret)],
  );
  return { id: rows[0].id, name, slug, joinSecret, checkinSecret };
}

/** Grant admin role at a gym. Upserts — safe to call multiple times. */
export async function makeAdmin(userId: string, gymId: string): Promise<void> {
  await query(
    `INSERT INTO user_gyms (user_id, gym_id, role) VALUES ($1, $2, 'admin')
     ON CONFLICT (user_id, gym_id) DO UPDATE SET role = 'admin'`,
    [userId, gymId],
  );
}

/** Insert a user_gyms member row (non-admin). */
export async function makeGymMember(userId: string, gymId: string): Promise<void> {
  await query(
    `INSERT INTO user_gyms (user_id, gym_id, role) VALUES ($1, $2, 'member')
     ON CONFLICT (user_id, gym_id) DO NOTHING`,
    [userId, gymId],
  );
}

/** Create an active membership for a user at a gym (today → +30 days). */
export async function createActiveMembership(userId: string, gymId: string): Promise<{ id: string }> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO memberships (user_id, gym_id, start_date, end_date)
     VALUES ($1, $2, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days') RETURNING id`,
    [userId, gymId],
  );
  return rows[0];
}

/**
 * Register a user via the API and return their cookie + user object.
 * Use unique emails per test to avoid lockout state bleed.
 */
export async function registerAndLogin(
  email: string,
  password = 'password123',
  fullName?: string,
): Promise<{ cookie: string; userId: string; email: string }> {
  const regRes = await request(app)
    .post('/api/auth/register')
    .send({ email, password, full_name: fullName });
  if (regRes.status !== 201) throw new Error(`Register failed: ${JSON.stringify(regRes.body)}`);

  const loginRes = await request(app).post('/api/auth/login').send({ email, password });
  if (loginRes.status !== 200) throw new Error(`Login failed: ${JSON.stringify(loginRes.body)}`);

  const setCookie = loginRes.headers['set-cookie'] as string[] | string;
  const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  const userId = loginRes.body.user.id as string;
  return { cookie, userId, email };
}

/** Promote a user to super-admin directly in the DB. */
export async function makeSuperAdmin(userId: string): Promise<void> {
  await query(`UPDATE users SET is_super_admin = true WHERE id = $1`, [userId]);
}

/**
 * Register a user, promote to super-admin, then re-login so the returned
 * cookie carries a JWT with is_super_admin: true.
 */
export async function registerAndLoginAsSuperAdmin(
  email: string,
  password = 'password123',
): Promise<{ cookie: string; userId: string }> {
  const { userId } = await registerAndLogin(email, password);
  await makeSuperAdmin(userId);
  const loginRes = await request(app).post('/api/auth/login').send({ email, password });
  const setCookie = loginRes.headers['set-cookie'] as string[] | string;
  const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return { cookie, userId };
}

/**
 * Insert a password reset token with a known plaintext code directly into
 * the DB, bypassing the email flow. Pass expired=true to create an already-
 * expired token for negative testing.
 */
export async function createTestResetToken(
  userId: string,
  code: string,
  expired = false,
): Promise<void> {
  const codeHash = await argon2.hash(code);
  const expiresAt = expired
    ? new Date(Date.now() - 1_000)
    : new Date(Date.now() + 15 * 60 * 1_000);
  await query(
    `INSERT INTO password_reset_tokens (user_id, code_hash, expires_at) VALUES ($1, $2, $3)`,
    [userId, codeHash, expiresAt],
  );
}

/** Insert a check-in row directly, bypassing the API dedup window. */
export async function insertCheckIn(userId: string, gymId: string, checkedInAt: Date): Promise<void> {
  await query(
    `INSERT INTO check_ins (user_id, gym_id, checked_in_at) VALUES ($1, $2, $3)`,
    [userId, gymId, checkedInAt],
  );
}

/**
 * Returns midnight UTC on the Monday of the week that is `weeksAgo` full weeks
 * before the current week. Safe to use in reward streak tests regardless of the
 * current day of week.
 */
export function mondayOf(weeksAgo: number, hourOffset = 10): Date {
  const now = new Date();
  const dow = now.getUTCDay();
  const daysFromMonday = dow === 0 ? 6 : dow - 1;
  const d = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - daysFromMonday - weeksAgo * 7,
    hourOffset,
  ));
  return d;
}

/** Insert a reward rule row directly. */
export async function createRewardRule(
  gymId: string,
  data: { type: 'milestone' | 'streak' | 'comeback'; threshold: number; discount_percent?: number; description?: string },
): Promise<{ id: string }> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO reward_rules (gym_id, type, threshold, discount_percent, description)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [gymId, data.type, data.threshold, data.discount_percent ?? 10, data.description ?? `${data.type} rule`],
  );
  return rows[0];
}

/** Create a membership that already expired yesterday. */
export async function createExpiredMembership(userId: string, gymId: string): Promise<void> {
  await query(
    `INSERT INTO memberships (user_id, gym_id, start_date, end_date)
     VALUES ($1, $2, CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE - INTERVAL '1 day')`,
    [userId, gymId],
  );
}

/** Build a signed v=1 (static) join QR payload for a gym. */
export function buildJoinQr(gymId: string, secret: string): Record<string, unknown> {
  return signQrPayload('join', gymId, secret) as unknown as Record<string, unknown>;
}

/** Build a signed v=1 (static) check-in QR payload for a gym. */
export function buildCheckinQr(gymId: string, secret: string): Record<string, unknown> {
  return signQrPayload('checkin', gymId, secret) as unknown as Record<string, unknown>;
}

/** Build a signed v=2 (rotating) check-in QR payload for a gym. */
export function buildRotatingCheckinQr(gymId: string, secret: string): Record<string, unknown> {
  return signRotatingCheckinPayload(gymId, secret) as unknown as Record<string, unknown>;
}
