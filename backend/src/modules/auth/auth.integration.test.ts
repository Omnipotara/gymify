import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { truncateAll } from '../../test/helpers';

const AUTH = '/api/auth';

describe('Auth API', () => {
  beforeEach(() => truncateAll());

  // ── Register ────────────────────────────────────────────────────────────────

  describe('POST /api/auth/register', () => {
    it('creates a user and returns a user object with an HttpOnly cookie', async () => {
      const res = await request(app)
        .post(`${AUTH}/register`)
        .send({ email: 'alice@example.com', password: 'password123', full_name: 'Alice' });

      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe('alice@example.com');
      expect(res.body.user.full_name).toBe('Alice');
      expect(res.body.user).not.toHaveProperty('password_hash');
      expect(res.body).not.toHaveProperty('token');

      const raw = res.headers['set-cookie'];
      const cookies = (Array.isArray(raw) ? raw : [raw]) as string[];
      expect(cookies.some((c) => c.startsWith('token='))).toBe(true);
      expect(cookies.some((c) => c.toLowerCase().includes('httponly'))).toBe(true);
    });

    it('rejects a duplicate email with 409', async () => {
      await request(app).post(`${AUTH}/register`).send({ email: 'alice@example.com', password: 'password123' });
      const res = await request(app).post(`${AUTH}/register`).send({ email: 'alice@example.com', password: 'other123' });
      expect(res.status).toBe(409);
    });

    it('is case-insensitive — duplicate email in different case returns 409', async () => {
      await request(app).post(`${AUTH}/register`).send({ email: 'alice@example.com', password: 'password123' });
      const res = await request(app).post(`${AUTH}/register`).send({ email: 'ALICE@EXAMPLE.COM', password: 'password123' });
      expect(res.status).toBe(409);
    });

    it('rejects invalid email format with 400', async () => {
      const res = await request(app).post(`${AUTH}/register`).send({ email: 'not-an-email', password: 'password123' });
      expect(res.status).toBe(400);
    });

    it('rejects missing password with 400', async () => {
      const res = await request(app).post(`${AUTH}/register`).send({ email: 'alice@example.com' });
      expect(res.status).toBe(400);
    });
  });

  // ── Login ───────────────────────────────────────────────────────────────────

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app)
        .post(`${AUTH}/register`)
        .send({ email: 'alice@example.com', password: 'password123' });
    });

    it('returns user and sets HttpOnly token cookie on success', async () => {
      const res = await request(app)
        .post(`${AUTH}/login`)
        .send({ email: 'alice@example.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('alice@example.com');
      expect(res.body).not.toHaveProperty('token');

      const raw = res.headers['set-cookie'];
      const cookies = (Array.isArray(raw) ? raw : [raw]) as string[];
      expect(cookies.some((c) => c.startsWith('token='))).toBe(true);
      expect(cookies.some((c) => c.toLowerCase().includes('httponly'))).toBe(true);
      expect(cookies.some((c) => c.toLowerCase().includes('samesite=strict'))).toBe(true);
    });

    it('is case-insensitive for email', async () => {
      const res = await request(app)
        .post(`${AUTH}/login`)
        .send({ email: 'ALICE@EXAMPLE.COM', password: 'password123' });
      expect(res.status).toBe(200);
    });

    it('returns 401 for wrong password', async () => {
      const res = await request(app)
        .post(`${AUTH}/login`)
        .send({ email: 'alice@example.com', password: 'wrong' });
      expect(res.status).toBe(401);
    });

    it('returns 401 for unknown email (no enumeration leak)', async () => {
      const res = await request(app)
        .post(`${AUTH}/login`)
        .send({ email: 'nobody@example.com', password: 'password123' });
      expect(res.status).toBe(401);
    });

    it('locks account after 10 failed attempts and rejects correct password with 429', async () => {
      // Use a different email so this test's lockout state is isolated
      await request(app).post(`${AUTH}/register`).send({ email: 'lockout@example.com', password: 'password123' });

      for (let i = 0; i < 10; i++) {
        await request(app).post(`${AUTH}/login`).send({ email: 'lockout@example.com', password: 'wrong' });
      }

      const res = await request(app)
        .post(`${AUTH}/login`)
        .send({ email: 'lockout@example.com', password: 'password123' });
      expect(res.status).toBe(429);
    });
  });

  // ── Logout ──────────────────────────────────────────────────────────────────

  describe('POST /api/auth/logout', () => {
    it('responds 204 and clears the token cookie', async () => {
      await request(app).post(`${AUTH}/register`).send({ email: 'alice@example.com', password: 'password123' });
      const loginRes = await request(app).post(`${AUTH}/login`).send({ email: 'alice@example.com', password: 'password123' });
      const rawLogin = loginRes.headers['set-cookie'];
      const cookie = (Array.isArray(rawLogin) ? rawLogin : [rawLogin])[0] as string;

      const res = await request(app).post(`${AUTH}/logout`).set('Cookie', cookie);
      expect(res.status).toBe(204);

      // The clearing Set-Cookie should have Max-Age=0 (or Expires in the past)
      const rawClear = res.headers['set-cookie'];
      const clearCookies = (Array.isArray(rawClear) ? rawClear : [rawClear]) as string[];
      expect(clearCookies.some((c) => c.startsWith('token=;') || c.includes('Max-Age=0'))).toBe(true);
    });
  });

  // ── /api/me ─────────────────────────────────────────────────────────────────

  describe('GET /api/me', () => {
    it('returns the authenticated user when cookie is present', async () => {
      await request(app).post(`${AUTH}/register`).send({ email: 'alice@example.com', password: 'password123' });
      const loginRes = await request(app).post(`${AUTH}/login`).send({ email: 'alice@example.com', password: 'password123' });
      const rawMe = loginRes.headers['set-cookie'];
      const cookie = (Array.isArray(rawMe) ? rawMe : [rawMe])[0] as string;

      const res = await request(app).get('/api/me').set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body.email).toBe('alice@example.com');
    });

    it('returns 401 when no cookie is sent', async () => {
      const res = await request(app).get('/api/me');
      expect(res.status).toBe(401);
    });
  });
});
