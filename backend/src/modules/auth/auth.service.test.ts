import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConflictError, TooManyRequestsError, UnauthorizedError } from '../../lib/errors';

vi.mock('./auth.repository');
vi.mock('../../lib/email');
vi.mock('argon2', () => ({
  default: {
    hash: vi.fn(),
    verify: vi.fn(),
  },
}));

import * as repo from './auth.repository';
import * as emailLib from '../../lib/email';
import argon2 from 'argon2';
import { login, register, requestPasswordReset, resetPassword } from './auth.service';
import type { DbResetToken, DbUser } from './auth.types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<DbUser> = {}): DbUser {
  return {
    id: 'user-1',
    email: 'user@test.com',
    password_hash: '$hashed',
    full_name: 'Test User',
    is_super_admin: false,
    phone: null,
    ...overrides,
  };
}

function makeToken(overrides: Partial<DbResetToken> = {}): DbResetToken {
  return {
    id: 1,
    user_id: 'user-1',
    code_hash: '$hashed-code',
    expires_at: new Date(Date.now() + 15 * 60 * 1_000),
    used_at: null,
    ...overrides,
  };
}

/** Attempt login N times with a wrong password, swallowing each error. */
async function failLogins(
  email: string,
  count: number,
  userOverrides: Partial<DbUser> = {},
): Promise<void> {
  const user = makeUser({ email, ...userOverrides });
  vi.mocked(repo.findUserByEmail).mockResolvedValue(user);
  vi.mocked(repo.isUserAdmin).mockResolvedValue(false);
  vi.mocked(argon2.verify as ReturnType<typeof vi.fn>).mockResolvedValue(false);
  for (let i = 0; i < count; i++) {
    await login({ email, password: 'wrong' }).catch(() => {});
  }
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(argon2.hash as ReturnType<typeof vi.fn>).mockResolvedValue('$hashed');
  vi.mocked(argon2.verify as ReturnType<typeof vi.fn>).mockResolvedValue(false);
  vi.mocked(emailLib.sendPasswordResetEmail).mockResolvedValue(undefined);
});

afterEach(() => vi.useRealTimers());

// ── register ──────────────────────────────────────────────────────────────────

describe('register', () => {
  it('creates account and returns an auth token', async () => {
    vi.mocked(repo.findUserByEmail).mockResolvedValue(null);
    vi.mocked(repo.createUser).mockResolvedValue(makeUser());

    const result = await register({ email: 'new@test.com', password: 'Password1!' });

    expect(result.token).toBeTruthy();
    expect(result.user.id).toBe('user-1');
    expect(repo.createUser).toHaveBeenCalledOnce();
  });

  it('throws ConflictError when email is already registered', async () => {
    vi.mocked(repo.findUserByEmail).mockResolvedValue(makeUser());

    await expect(register({ email: 'exists@test.com', password: 'pass' }))
      .rejects.toThrow(ConflictError);
    expect(repo.createUser).not.toHaveBeenCalled();
  });
});

// ── login — basics ────────────────────────────────────────────────────────────

describe('login — basics', () => {
  it('returns a signed token on valid credentials', async () => {
    vi.mocked(repo.findUserByEmail).mockResolvedValue(makeUser({ email: 'ok@test.com' }));
    vi.mocked(repo.isUserAdmin).mockResolvedValue(false);
    vi.mocked(argon2.verify as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const result = await login({ email: 'ok@test.com', password: 'correct' });

    expect(result.token).toBeTruthy();
    expect(result.user.email).toBe('ok@test.com');
  });

  it('throws UnauthorizedError for wrong password', async () => {
    vi.mocked(repo.findUserByEmail).mockResolvedValue(makeUser({ email: 'wrongpw@test.com' }));
    vi.mocked(repo.isUserAdmin).mockResolvedValue(false);

    await expect(login({ email: 'wrongpw@test.com', password: 'bad' }))
      .rejects.toThrow(UnauthorizedError);
  });

  it('throws UnauthorizedError for unknown email without revealing existence', async () => {
    vi.mocked(repo.findUserByEmail).mockResolvedValue(null);

    await expect(login({ email: 'ghost@test.com', password: 'any' }))
      .rejects.toThrow(UnauthorizedError);
    expect(argon2.verify).toHaveBeenCalledOnce();
  });

  it('normalises email to lowercase before lookup', async () => {
    vi.mocked(repo.findUserByEmail).mockResolvedValue(null);

    await login({ email: 'UPPER@Test.COM', password: 'x' }).catch(() => {});

    expect(repo.findUserByEmail).toHaveBeenCalledWith('upper@test.com');
  });
});

// ── Brute-force lockout — regular user (threshold: 10) ───────────────────────

describe('brute-force — regular user (threshold 10)', () => {
  it('does not lock after 9 failures — 10th attempt returns UnauthorizedError', async () => {
    await failLogins('reg9@test.com', 9);

    vi.mocked(argon2.verify as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    await expect(login({ email: 'reg9@test.com', password: 'bad' }))
      .rejects.toThrow(UnauthorizedError);
  });

  it('locks after 10 failures — 11th attempt returns TooManyRequestsError', async () => {
    await failLogins('reg10@test.com', 10);

    await expect(login({ email: 'reg10@test.com', password: 'bad' }))
      .rejects.toThrow(TooManyRequestsError);
  });

  it('skips argon2 entirely once account is locked', async () => {
    await failLogins('reg-skip@test.com', 10);
    vi.clearAllMocks();

    await login({ email: 'reg-skip@test.com', password: 'bad' }).catch(() => {});

    expect(argon2.verify).not.toHaveBeenCalled();
    expect(repo.findUserByEmail).not.toHaveBeenCalled();
  });
});

// ── Brute-force lockout — gym admin (threshold: 5) ───────────────────────────

describe('brute-force — gym admin (threshold 5)', () => {
  it('does not lock after 4 failures — 5th attempt returns UnauthorizedError', async () => {
    const email = 'admin4@test.com';
    vi.mocked(repo.findUserByEmail).mockResolvedValue(makeUser({ email }));
    vi.mocked(repo.isUserAdmin).mockResolvedValue(true);
    vi.mocked(argon2.verify as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    for (let i = 0; i < 4; i++) {
      await login({ email, password: 'wrong' }).catch(() => {});
    }

    await expect(login({ email, password: 'wrong' }))
      .rejects.toThrow(UnauthorizedError);
  });

  it('locks after 5 failures — 6th attempt returns TooManyRequestsError', async () => {
    const email = 'admin5@test.com';
    vi.mocked(repo.findUserByEmail).mockResolvedValue(makeUser({ email }));
    vi.mocked(repo.isUserAdmin).mockResolvedValue(true);
    vi.mocked(argon2.verify as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    for (let i = 0; i < 5; i++) {
      await login({ email, password: 'wrong' }).catch(() => {});
    }

    await expect(login({ email, password: 'wrong' }))
      .rejects.toThrow(TooManyRequestsError);
  });
});

// ── Brute-force lockout — super admin (threshold: 5) ─────────────────────────

describe('brute-force — super admin (threshold 5)', () => {
  it('locks after 5 failures', async () => {
    const email = 'super5@test.com';
    vi.mocked(repo.findUserByEmail).mockResolvedValue(makeUser({ email, is_super_admin: true }));
    vi.mocked(argon2.verify as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    for (let i = 0; i < 5; i++) {
      await login({ email, password: 'wrong' }).catch(() => {});
    }

    await expect(login({ email, password: 'wrong' }))
      .rejects.toThrow(TooManyRequestsError);
  });

  it('never calls isUserAdmin for super admins (short-circuits on is_super_admin flag)', async () => {
    const email = 'super-noadmin@test.com';
    vi.mocked(repo.findUserByEmail).mockResolvedValue(makeUser({ email, is_super_admin: true }));
    vi.mocked(argon2.verify as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    await login({ email, password: 'wrong' }).catch(() => {});

    expect(repo.isUserAdmin).not.toHaveBeenCalled();
  });
});

// ── Brute-force lockout — recovery ───────────────────────────────────────────

describe('brute-force — recovery', () => {
  it('clears counter on successful login, allowing a fresh failure window', async () => {
    const email = 'recovery@test.com';
    await failLogins(email, 9);

    vi.mocked(repo.findUserByEmail).mockResolvedValue(makeUser({ email }));
    vi.mocked(repo.isUserAdmin).mockResolvedValue(false);
    vi.mocked(argon2.verify as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    await login({ email, password: 'correct' });

    await failLogins(email, 9);
    vi.mocked(argon2.verify as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    await expect(login({ email, password: 'bad' }))
      .rejects.toThrow(UnauthorizedError);
  });

  it('unblocks after the 15-minute lockout expires', async () => {
    vi.useFakeTimers();
    const email = 'lockexpire@test.com';
    await failLogins(email, 10);

    await expect(login({ email, password: 'any' }))
      .rejects.toThrow(TooManyRequestsError);

    vi.advanceTimersByTime(15 * 60 * 1000 + 1);

    vi.mocked(repo.findUserByEmail).mockResolvedValue(makeUser({ email }));
    vi.mocked(repo.isUserAdmin).mockResolvedValue(false);
    vi.mocked(argon2.verify as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    await expect(login({ email, password: 'bad' }))
      .rejects.toThrow(UnauthorizedError);
  });

  it('starts a fresh window after 15 minutes of inactivity', async () => {
    vi.useFakeTimers();
    const email = 'windowreset@test.com';

    await failLogins(email, 9);
    vi.advanceTimersByTime(15 * 60 * 1000 + 1);

    await failLogins(email, 9);
    vi.mocked(argon2.verify as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    await expect(login({ email, password: 'bad' }))
      .rejects.toThrow(UnauthorizedError);
  });
});

// ── Brute-force lockout — unknown email ──────────────────────────────────────

describe('brute-force — unknown email', () => {
  it('tracks unknown email with user threshold (10)', async () => {
    const email = 'unknown10@test.com';
    vi.mocked(repo.findUserByEmail).mockResolvedValue(null);

    for (let i = 0; i < 10; i++) {
      await login({ email, password: 'wrong' }).catch(() => {});
    }

    await expect(login({ email, password: 'wrong' }))
      .rejects.toThrow(TooManyRequestsError);
  });

  it('does not lock unknown email after 9 attempts', async () => {
    const email = 'unknown9@test.com';
    vi.mocked(repo.findUserByEmail).mockResolvedValue(null);

    for (let i = 0; i < 9; i++) {
      await login({ email, password: 'wrong' }).catch(() => {});
    }

    await expect(login({ email, password: 'wrong' }))
      .rejects.toThrow(UnauthorizedError);
  });
});

// ── Brute-force lockout — edge cases ─────────────────────────────────────────

describe('brute-force — edge cases', () => {
  it('shares lockout counter across mixed-case variants of the same email', async () => {
    const email = 'MixedCase@EXAMPLE.COM';
    const normalised = 'mixedcase@example.com';
    vi.mocked(repo.findUserByEmail).mockResolvedValue(makeUser({ email: normalised }));
    vi.mocked(repo.isUserAdmin).mockResolvedValue(true);
    vi.mocked(argon2.verify as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    for (let i = 0; i < 5; i++) {
      await login({ email, password: 'wrong' }).catch(() => {});
    }

    await expect(login({ email: normalised, password: 'wrong' }))
      .rejects.toThrow(TooManyRequestsError);
  });

  it('tightens threshold mid-window when role is found to be admin on a later attempt', async () => {
    const email = 'rolechange@test.com';
    const user = makeUser({ email });
    vi.mocked(repo.findUserByEmail).mockResolvedValue(user);
    vi.mocked(argon2.verify as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    vi.mocked(repo.isUserAdmin).mockResolvedValue(false);
    for (let i = 0; i < 4; i++) {
      await login({ email, password: 'wrong' }).catch(() => {});
    }

    vi.mocked(repo.isUserAdmin).mockResolvedValue(true);
    await login({ email, password: 'wrong' }).catch(() => {});

    await expect(login({ email, password: 'wrong' }))
      .rejects.toThrow(TooManyRequestsError);
  });

  it('propagates isUserAdmin DB errors without recording a lockout failure', async () => {
    const email = 'dberror@test.com';
    vi.mocked(repo.findUserByEmail).mockResolvedValue(makeUser({ email }));
    vi.mocked(repo.isUserAdmin).mockRejectedValue(new Error('DB connection lost'));

    await expect(login({ email, password: 'any' }))
      .rejects.toThrow('DB connection lost');

    vi.mocked(repo.isUserAdmin).mockResolvedValue(false);
    vi.mocked(argon2.verify as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    await expect(login({ email, password: 'wrong' }))
      .rejects.toThrow(UnauthorizedError);
  });
});

// ── requestPasswordReset ──────────────────────────────────────────────────────

describe('requestPasswordReset', () => {
  it('invalidates old tokens, creates new token, sends email for a known address', async () => {
    vi.mocked(repo.findUserByEmail).mockResolvedValue(makeUser());
    vi.mocked(repo.invalidateResetTokens).mockResolvedValue(undefined);
    vi.mocked(repo.createResetToken).mockResolvedValue(undefined);

    await requestPasswordReset('user@test.com');

    expect(repo.invalidateResetTokens).toHaveBeenCalledWith('user-1');
    expect(repo.createResetToken).toHaveBeenCalledOnce();
    expect(emailLib.sendPasswordResetEmail).toHaveBeenCalledWith('user@test.com', expect.any(String));
  });

  it('sends a 6-digit numeric code', async () => {
    vi.mocked(repo.findUserByEmail).mockResolvedValue(makeUser());
    vi.mocked(repo.invalidateResetTokens).mockResolvedValue(undefined);
    vi.mocked(repo.createResetToken).mockResolvedValue(undefined);

    await requestPasswordReset('user@test.com');

    const [, code] = vi.mocked(emailLib.sendPasswordResetEmail).mock.calls[0];
    expect(code).toMatch(/^\d{6}$/);
  });

  it('returns silently for an unknown email — no enumeration', async () => {
    vi.mocked(repo.findUserByEmail).mockResolvedValue(null);

    await expect(requestPasswordReset('ghost@test.com')).resolves.toBeUndefined();
    expect(repo.invalidateResetTokens).not.toHaveBeenCalled();
    expect(emailLib.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('stores the token with a hash, not the raw code', async () => {
    vi.mocked(repo.findUserByEmail).mockResolvedValue(makeUser());
    vi.mocked(repo.invalidateResetTokens).mockResolvedValue(undefined);
    vi.mocked(repo.createResetToken).mockResolvedValue(undefined);

    await requestPasswordReset('user@test.com');

    const [, code] = vi.mocked(emailLib.sendPasswordResetEmail).mock.calls[0];
    const { codeHash } = vi.mocked(repo.createResetToken).mock.calls[0][0];
    // The stored hash must differ from the raw code
    expect(codeHash).not.toBe(code);
    // argon2.hash was called (our mock returns '$hashed')
    expect(argon2.hash).toHaveBeenCalledWith(code);
  });
});

// ── resetPassword ─────────────────────────────────────────────────────────────

describe('resetPassword', () => {
  it('updates the password and marks the token used on valid code', async () => {
    vi.mocked(repo.findUserByEmail).mockResolvedValue(makeUser());
    vi.mocked(repo.findValidResetToken).mockResolvedValue(makeToken());
    vi.mocked(repo.markResetTokenUsed).mockResolvedValue(undefined);
    vi.mocked(repo.updateUserPassword).mockResolvedValue(undefined);
    vi.mocked(argon2.verify as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    await resetPassword({ email: 'user@test.com', code: '123456', newPassword: 'newPass99!' });

    expect(repo.updateUserPassword).toHaveBeenCalledWith('user-1', '$hashed');
    expect(repo.markResetTokenUsed).toHaveBeenCalledWith(1);
  });

  it('throws UnauthorizedError for an unknown email', async () => {
    vi.mocked(repo.findUserByEmail).mockResolvedValue(null);

    await expect(
      resetPassword({ email: 'ghost@test.com', code: '123456', newPassword: 'newPass99!' }),
    ).rejects.toThrow(UnauthorizedError);
    expect(repo.updateUserPassword).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedError when no valid token exists', async () => {
    vi.mocked(repo.findUserByEmail).mockResolvedValue(makeUser());
    vi.mocked(repo.findValidResetToken).mockResolvedValue(null);

    await expect(
      resetPassword({ email: 'user@test.com', code: '123456', newPassword: 'newPass99!' }),
    ).rejects.toThrow(UnauthorizedError);
    expect(repo.updateUserPassword).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedError for an incorrect code', async () => {
    vi.mocked(repo.findUserByEmail).mockResolvedValue(makeUser());
    vi.mocked(repo.findValidResetToken).mockResolvedValue(makeToken());
    vi.mocked(argon2.verify as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    await expect(
      resetPassword({ email: 'user@test.com', code: '999999', newPassword: 'newPass99!' }),
    ).rejects.toThrow(UnauthorizedError);
    expect(repo.updateUserPassword).not.toHaveBeenCalled();
    expect(repo.markResetTokenUsed).not.toHaveBeenCalled();
  });

  it('clears the lockout entry for the account on success', async () => {
    const email = 'locked-reset@test.com';
    // Build up some failed login attempts
    vi.mocked(repo.findUserByEmail).mockResolvedValue(makeUser({ email }));
    vi.mocked(repo.isUserAdmin).mockResolvedValue(false);
    vi.mocked(argon2.verify as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    for (let i = 0; i < 10; i++) {
      await login({ email, password: 'wrong' }).catch(() => {});
    }
    await expect(login({ email, password: 'wrong' })).rejects.toThrow(TooManyRequestsError);

    // Reset clears the lockout
    vi.mocked(repo.findValidResetToken).mockResolvedValue(makeToken({ user_id: 'user-1' }));
    vi.mocked(repo.markResetTokenUsed).mockResolvedValue(undefined);
    vi.mocked(repo.updateUserPassword).mockResolvedValue(undefined);
    vi.mocked(argon2.verify as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    await resetPassword({ email, code: '123456', newPassword: 'newPass99!' });

    // Now login should return UnauthorizedError (wrong password), not TooManyRequests
    vi.mocked(argon2.verify as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    await expect(login({ email, password: 'wrong' })).rejects.toThrow(UnauthorizedError);
  });
});
