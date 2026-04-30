import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { ConflictError, TooManyRequestsError, UnauthorizedError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import * as repo from './auth.repository';
import type { AuthResponse, DbUser } from './auth.types';

// ── Timing protection ─────────────────────────────────────────────────────────

// Computed once on first use so that a missing-user login takes the same
// wall-clock time as a wrong-password login, preventing email enumeration.
let _dummyHashPromise: Promise<string> | null = null;
function dummyHash(): Promise<string> {
  if (!_dummyHashPromise) {
    _dummyHashPromise = argon2.hash('gymify_timing_protection_not_a_real_password');
  }
  return _dummyHashPromise;
}

// ── Per-account brute-force lockout ───────────────────────────────────────────

const ADMIN_THRESHOLD = 5;   // failed attempts before lockout for admins/super-admins
const USER_THRESHOLD = 10;   // failed attempts before lockout for regular members
const WINDOW_MS = 15 * 60 * 1000;   // rolling window: 15 minutes
const LOCKOUT_MS = 15 * 60 * 1000;  // lockout duration: 15 minutes

interface LockoutEntry {
  count: number;
  windowStart: number;
  lockedUntil: number | null;
  threshold: number;
}

const lockouts = new Map<string, LockoutEntry>();

// Sweep expired entries once per hour to prevent unbounded memory growth.
setInterval(() => {
  const now = Date.now();
  for (const [email, entry] of lockouts) {
    const windowExpired = now - entry.windowStart > WINDOW_MS;
    const lockExpired = entry.lockedUntil === null || now > entry.lockedUntil;
    if (windowExpired && lockExpired) lockouts.delete(email);
  }
}, 60 * 60 * 1000).unref();

function checkLockout(email: string): void {
  const entry = lockouts.get(email);
  if (!entry) return;
  if (entry.lockedUntil !== null && Date.now() < entry.lockedUntil) {
    logger.warn({ security: true, event: 'login_blocked', email }, 'Login blocked — account locked');
    throw new TooManyRequestsError('Too many failed login attempts. Try again in 15 minutes.');
  }
}

function recordFailure(email: string, threshold: number): void {
  const now = Date.now();
  const existing = lockouts.get(email);

  if (!existing || now - existing.windowStart > WINDOW_MS) {
    lockouts.set(email, { count: 1, windowStart: now, lockedUntil: null, threshold });
    return;
  }

  existing.count += 1;
  existing.threshold = threshold; // update if role was determined this attempt

  if (existing.count >= threshold) {
    existing.lockedUntil = now + LOCKOUT_MS;
    logger.warn(
      { security: true, event: 'account_locked', email, attempts: existing.count },
      'Account locked after too many failed attempts',
    );
  }
}

// ── JWT + response helpers ────────────────────────────────────────────────────

function signToken(user: DbUser): string {
  return jwt.sign(
    { email: user.email, is_super_admin: user.is_super_admin },
    config.jwtSecret,
    { subject: user.id, expiresIn: '1h' },
  );
}

function toResponse(user: DbUser): AuthResponse {
  return {
    token: signToken(user),
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      is_super_admin: user.is_super_admin,
    },
  };
}

// ── Public service functions ──────────────────────────────────────────────────

export async function register(data: {
  email: string;
  password: string;
  fullName?: string;
  phone?: string;
}): Promise<AuthResponse> {
  const existing = await repo.findUserByEmail(data.email);
  if (existing) throw new ConflictError('An account with this email already exists');

  const passwordHash = await argon2.hash(data.password);
  const user = await repo.createUser({ email: data.email, passwordHash, fullName: data.fullName, phone: data.phone });
  return toResponse(user);
}

export async function login(data: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const email = data.email.toLowerCase();

  checkLockout(email);

  const user = await repo.findUserByEmail(email);

  if (!user) {
    await argon2.verify(await dummyHash(), data.password).catch(() => {});
    logger.warn({ security: true, event: 'login_failed', reason: 'user_not_found' }, 'Login failed');
    recordFailure(email, USER_THRESHOLD);
    throw new UnauthorizedError('Invalid email or password');
  }

  // Determine threshold based on role — super-admins and gym admins get the tighter limit.
  const isAdmin = user.is_super_admin || await repo.isUserAdmin(user.id);
  const threshold = isAdmin ? ADMIN_THRESHOLD : USER_THRESHOLD;

  const valid = await argon2.verify(user.password_hash, data.password);
  if (!valid) {
    logger.warn({ security: true, event: 'login_failed', reason: 'wrong_password', userId: user.id }, 'Login failed');
    recordFailure(email, threshold);
    throw new UnauthorizedError('Invalid email or password');
  }

  lockouts.delete(email); // clear on successful login
  return toResponse(user);
}
