import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import {
  truncateAll,
  createTestGym,
  registerAndLogin,
  registerAndLoginAsSuperAdmin,
  makeGymMember,
  makeAdmin,
} from '../../test/helpers';

const ADMIN_API = '/api/admin';

describe('Admin Gym Admin Management API', () => {
  let superCookie: string;
  let memberCookie: string;
  let gymId: string;
  let targetUserId: string;

  beforeEach(async () => {
    await truncateAll();

    // Super-admin: register, promote in DB, re-login so JWT carries the flag
    ({ cookie: superCookie } = await registerAndLoginAsSuperAdmin('super@test.com'));

    // Regular member (not a super-admin) for 403 checks
    ({ cookie: memberCookie } = await registerAndLogin('member@test.com'));

    // A gym and a target user to be added/removed as admin
    const gym = await createTestGym('Test Gym');
    gymId = gym.id;
    ({ userId: targetUserId } = await registerAndLogin('target@test.com'));
  });

  // ── GET /api/admin/gyms/:gymId/admins ────────────────────────────────────────

  describe('GET /api/admin/gyms/:gymId/admins', () => {
    it('returns an empty array when the gym has no admins', async () => {
      const res = await request(app)
        .get(`${ADMIN_API}/gyms/${gymId}/admins`)
        .set('Cookie', superCookie);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns the current list of admins', async () => {
      await makeAdmin(targetUserId, gymId);

      const res = await request(app)
        .get(`${ADMIN_API}/gyms/${gymId}/admins`)
        .set('Cookie', superCookie);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(targetUserId);
      expect(res.body[0]).not.toHaveProperty('password_hash');
    });

    it('does not include members — only admins', async () => {
      await makeGymMember(targetUserId, gymId);

      const res = await request(app)
        .get(`${ADMIN_API}/gyms/${gymId}/admins`)
        .set('Cookie', superCookie);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns 403 for a non-super-admin', async () => {
      const res = await request(app)
        .get(`${ADMIN_API}/gyms/${gymId}/admins`)
        .set('Cookie', memberCookie);
      expect(res.status).toBe(403);
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).get(`${ADMIN_API}/gyms/${gymId}/admins`);
      expect(res.status).toBe(401);
    });
  });

  // ── POST /api/admin/gyms/:gymId/admins ───────────────────────────────────────

  describe('POST /api/admin/gyms/:gymId/admins', () => {
    it('adds a user as gym admin by email → 201, user appears in admin list', async () => {
      const res = await request(app)
        .post(`${ADMIN_API}/gyms/${gymId}/admins`)
        .set('Cookie', superCookie)
        .send({ email: 'target@test.com' });

      expect(res.status).toBe(201);

      const listRes = await request(app)
        .get(`${ADMIN_API}/gyms/${gymId}/admins`)
        .set('Cookie', superCookie);
      expect(listRes.body.some((a: { id: string }) => a.id === targetUserId)).toBe(true);
    });

    it('promotes an existing member to admin', async () => {
      await makeGymMember(targetUserId, gymId);

      const res = await request(app)
        .post(`${ADMIN_API}/gyms/${gymId}/admins`)
        .set('Cookie', superCookie)
        .send({ email: 'target@test.com' });

      expect(res.status).toBe(201);

      const listRes = await request(app)
        .get(`${ADMIN_API}/gyms/${gymId}/admins`)
        .set('Cookie', superCookie);
      expect(listRes.body.some((a: { id: string }) => a.id === targetUserId)).toBe(true);
    });

    it('is idempotent — adding the same admin twice both return 201', async () => {
      const first = await request(app)
        .post(`${ADMIN_API}/gyms/${gymId}/admins`)
        .set('Cookie', superCookie)
        .send({ email: 'target@test.com' });
      const second = await request(app)
        .post(`${ADMIN_API}/gyms/${gymId}/admins`)
        .set('Cookie', superCookie)
        .send({ email: 'target@test.com' });

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);

      // Still only one entry in the admin list
      const listRes = await request(app)
        .get(`${ADMIN_API}/gyms/${gymId}/admins`)
        .set('Cookie', superCookie);
      expect(listRes.body.filter((a: { id: string }) => a.id === targetUserId)).toHaveLength(1);
    });

    it('returns 404 when the email does not match any user', async () => {
      const res = await request(app)
        .post(`${ADMIN_API}/gyms/${gymId}/admins`)
        .set('Cookie', superCookie)
        .send({ email: 'nobody@test.com' });
      expect(res.status).toBe(404);
    });

    it('returns 400 for an invalid email format', async () => {
      const res = await request(app)
        .post(`${ADMIN_API}/gyms/${gymId}/admins`)
        .set('Cookie', superCookie)
        .send({ email: 'not-an-email' });
      expect(res.status).toBe(400);
    });

    it('returns 403 for a non-super-admin', async () => {
      const res = await request(app)
        .post(`${ADMIN_API}/gyms/${gymId}/admins`)
        .set('Cookie', memberCookie)
        .send({ email: 'target@test.com' });
      expect(res.status).toBe(403);
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app)
        .post(`${ADMIN_API}/gyms/${gymId}/admins`)
        .send({ email: 'target@test.com' });
      expect(res.status).toBe(401);
    });
  });

  // ── DELETE /api/admin/gyms/:gymId/admins/:userId ─────────────────────────────

  describe('DELETE /api/admin/gyms/:gymId/admins/:userId', () => {
    it('removes an admin → 204 and user no longer appears in admin list', async () => {
      await makeAdmin(targetUserId, gymId);

      const res = await request(app)
        .delete(`${ADMIN_API}/gyms/${gymId}/admins/${targetUserId}`)
        .set('Cookie', superCookie);

      expect(res.status).toBe(204);

      const listRes = await request(app)
        .get(`${ADMIN_API}/gyms/${gymId}/admins`)
        .set('Cookie', superCookie);
      expect(listRes.body.some((a: { id: string }) => a.id === targetUserId)).toBe(false);
    });

    it('returns 404 when the user is not an admin of this gym', async () => {
      const res = await request(app)
        .delete(`${ADMIN_API}/gyms/${gymId}/admins/${targetUserId}`)
        .set('Cookie', superCookie);
      expect(res.status).toBe(404);
    });

    it('returns 404 for a member (not admin) — members are not in the admin list', async () => {
      await makeGymMember(targetUserId, gymId);

      const res = await request(app)
        .delete(`${ADMIN_API}/gyms/${gymId}/admins/${targetUserId}`)
        .set('Cookie', superCookie);
      expect(res.status).toBe(404);
    });

    it('returns 403 for a non-super-admin', async () => {
      await makeAdmin(targetUserId, gymId);

      const res = await request(app)
        .delete(`${ADMIN_API}/gyms/${gymId}/admins/${targetUserId}`)
        .set('Cookie', memberCookie);
      expect(res.status).toBe(403);
    });
  });
});
