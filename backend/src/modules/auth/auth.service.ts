import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { ConflictError, UnauthorizedError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import * as repo from './auth.repository';
import type { AuthResponse, DbUser } from './auth.types';

// Computed once on first use so that a missing-user login takes the same
// wall-clock time as a wrong-password login, preventing email enumeration.
let _dummyHashPromise: Promise<string> | null = null;
function dummyHash(): Promise<string> {
  if (!_dummyHashPromise) {
    _dummyHashPromise = argon2.hash('gymify_timing_protection_not_a_real_password');
  }
  return _dummyHashPromise;
}

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
  const user = await repo.findUserByEmail(data.email);

  if (!user) {
    // Run a real argon2 verification against a dummy hash so the response
    // time is indistinguishable from a wrong-password attempt.
    await argon2.verify(await dummyHash(), data.password).catch(() => {});
    logger.warn({ security: true, event: 'login_failed', reason: 'user_not_found' }, 'Login failed');
    throw new UnauthorizedError('Invalid email or password');
  }

  const valid = await argon2.verify(user.password_hash, data.password);
  if (!valid) {
    logger.warn({ security: true, event: 'login_failed', reason: 'wrong_password', userId: user.id }, 'Login failed');
    throw new UnauthorizedError('Invalid email or password');
  }

  return toResponse(user);
}
