import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import {
  truncateAll,
  createTestGym,
  registerAndLogin,
  registerAndLoginAsSuperAdmin,
  makeAdmin,
  makeGymMember,
} from '../../test/helpers';

const ADMIN = '/api/admin';

describe('Admin Platform API', () => {
  let superCookie: string;
  let superUserId: string;
  let memberCookie: string;

  beforeEach(async () => {
    await truncateAll();
    ({ cookie: superCookie, userId: superUserId } = await registerAndLoginAsSuperAdmin('super@test.com'));
    ({ cookie: memberCookie } = await registerAndLogin('member@test.com'));
  });

  // ── GET /api/admin/stats ─────────────────────────────────────────────────────

  describe('GET /api/admin/stats', () => {
    it('returns correct stat shape with zero counts on empty DB', async () => {
      const res = await request(app).get(`${ADMIN}/stats`).set('Cookie', superCookie);

      expect(res.status).toBe(200);
      expect(typeof res.body.gym_count).toBe('number');
      expect(typeof res.body.user_count).toBe('number');
      expect(typeof res.body.checkins_today).toBe('number');
      expect(typeof res.body.checkins_total).toBe('number');
      expect(typeof res.body.active_members).toBe('number');
      expect(typeof res.body.new_users_this_week).toBe('number');
    });

    it('reflects newly created gyms and users', async () => {
      await createTestGym();
      await registerAndLogin('another@test.com');

      const res = await request(app).get(`${ADMIN}/stats`).set('Cookie', superCookie);

      expect(res.status).toBe(200);
      // 3 users: super + member (beforeEach) + another
      expect(res.body.user_count).toBeGreaterThanOrEqual(3);
      expect(res.body.gym_count).toBeGreaterThanOrEqual(1);
    });

    it('returns 403 for a non-super-admin', async () => {
      const res = await request(app).get(`${ADMIN}/stats`).set('Cookie', memberCookie);
      expect(res.status).toBe(403);
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).get(`${ADMIN}/stats`);
      expect(res.status).toBe(401);
    });
  });

  // ── GET /api/admin/gyms ──────────────────────────────────────────────────────

  describe('GET /api/admin/gyms', () => {
    it('returns all gyms with member_count', async () => {
      const gym = await createTestGym('Iron Paradise');
      const { userId } = await registerAndLogin('user@test.com');
      await makeGymMember(userId, gym.id);

      const res = await request(app).get(`${ADMIN}/gyms`).set('Cookie', superCookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.items)).toBe(true);
      const found = res.body.items.find((g: { id: string }) => g.id === gym.id);
      expect(found).toBeDefined();
      expect(found.name).toBe('Iron Paradise');
      expect(found.member_count).toBe(1);
    });

    it('returns 403 for a non-super-admin', async () => {
      const res = await request(app).get(`${ADMIN}/gyms`).set('Cookie', memberCookie);
      expect(res.status).toBe(403);
    });
  });

  // ── POST /api/admin/gyms ─────────────────────────────────────────────────────

  describe('POST /api/admin/gyms', () => {
    it('creates a gym and returns id, name, slug', async () => {
      const res = await request(app)
        .post(`${ADMIN}/gyms`)
        .set('Cookie', superCookie)
        .send({ name: 'Powerhouse Gym' });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('Powerhouse Gym');
      expect(res.body.slug).toMatch(/powerhouse-gym/);
    });

    it('generates unique slugs when two gyms share the same name', async () => {
      const first = await request(app)
        .post(`${ADMIN}/gyms`).set('Cookie', superCookie).send({ name: 'Twin Gym' });
      const second = await request(app)
        .post(`${ADMIN}/gyms`).set('Cookie', superCookie).send({ name: 'Twin Gym' });

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(first.body.slug).not.toBe(second.body.slug);
    });

    it('returns 400 for a missing or empty name', async () => {
      const res = await request(app)
        .post(`${ADMIN}/gyms`)
        .set('Cookie', superCookie)
        .send({ name: '' });
      expect(res.status).toBe(400);
    });

    it('returns 403 for a non-super-admin', async () => {
      const res = await request(app)
        .post(`${ADMIN}/gyms`).set('Cookie', memberCookie).send({ name: 'Hack Gym' });
      expect(res.status).toBe(403);
    });
  });

  // ── DELETE /api/admin/gyms/:gymId ────────────────────────────────────────────

  describe('DELETE /api/admin/gyms/:gymId', () => {
    it('deletes a gym → 204, no longer appears in gym list', async () => {
      const gym = await createTestGym();

      const res = await request(app)
        .delete(`${ADMIN}/gyms/${gym.id}`)
        .set('Cookie', superCookie);
      expect(res.status).toBe(204);

      const list = await request(app).get(`${ADMIN}/gyms`).set('Cookie', superCookie);
      expect(list.body.items.some((g: { id: string }) => g.id === gym.id)).toBe(false);
    });

    it('returns 404 for a non-existent gym', async () => {
      const res = await request(app)
        .delete(`${ADMIN}/gyms/00000000-0000-0000-0000-000000000000`)
        .set('Cookie', superCookie);
      expect(res.status).toBe(404);
    });

    it('returns 403 for a non-super-admin', async () => {
      const gym = await createTestGym();
      const res = await request(app)
        .delete(`${ADMIN}/gyms/${gym.id}`)
        .set('Cookie', memberCookie);
      expect(res.status).toBe(403);
    });
  });

  // ── GET /api/admin/users ─────────────────────────────────────────────────────

  describe('GET /api/admin/users', () => {
    it('returns all users with their gyms array', async () => {
      const gym = await createTestGym();
      await makeAdmin(superUserId, gym.id);

      const res = await request(app).get(`${ADMIN}/users`).set('Cookie', superCookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.items)).toBe(true);

      const sa = res.body.items.find((u: { email: string }) => u.email === 'super@test.com');
      expect(sa).toBeDefined();
      expect(sa.is_super_admin).toBe(true);
      expect(Array.isArray(sa.gyms)).toBe(true);
      expect(sa.gyms.some((g: { gym_id: string }) => g.gym_id === gym.id)).toBe(true);
    });

    it('does not expose password_hash', async () => {
      const res = await request(app).get(`${ADMIN}/users`).set('Cookie', superCookie);
      expect(res.body.items.every((u: Record<string, unknown>) => !('password_hash' in u))).toBe(true);
    });

    it('returns 403 for a non-super-admin', async () => {
      const res = await request(app).get(`${ADMIN}/users`).set('Cookie', memberCookie);
      expect(res.status).toBe(403);
    });
  });

  // ── PATCH /api/admin/gyms/:gymId/members/:userId/role ────────────────────────

  describe('PATCH /api/admin/gyms/:gymId/members/:userId/role', () => {
    it('promotes a member to admin', async () => {
      const gym = await createTestGym();
      const { userId: targetId } = await registerAndLogin('target@test.com');
      await makeGymMember(targetId, gym.id);

      const res = await request(app)
        .patch(`${ADMIN}/gyms/${gym.id}/members/${targetId}/role`)
        .set('Cookie', superCookie)
        .send({ role: 'admin' });
      expect(res.status).toBe(204);

      // Verify via admin list
      const admins = await request(app)
        .get(`${ADMIN}/gyms/${gym.id}/admins`)
        .set('Cookie', superCookie);
      expect(admins.body.some((a: { id: string }) => a.id === targetId)).toBe(true);
    });

    it('demotes an admin to member', async () => {
      const gym = await createTestGym();
      const { userId: targetId } = await registerAndLogin('target@test.com');
      await makeAdmin(targetId, gym.id);

      const res = await request(app)
        .patch(`${ADMIN}/gyms/${gym.id}/members/${targetId}/role`)
        .set('Cookie', superCookie)
        .send({ role: 'member' });
      expect(res.status).toBe(204);

      const admins = await request(app)
        .get(`${ADMIN}/gyms/${gym.id}/admins`)
        .set('Cookie', superCookie);
      expect(admins.body.some((a: { id: string }) => a.id === targetId)).toBe(false);
    });

    it('returns 400 for an invalid role value', async () => {
      const gym = await createTestGym();
      const { userId: targetId } = await registerAndLogin('target2@test.com');

      const res = await request(app)
        .patch(`${ADMIN}/gyms/${gym.id}/members/${targetId}/role`)
        .set('Cookie', superCookie)
        .send({ role: 'superstar' });
      expect(res.status).toBe(400);
    });

    it('returns 403 for a non-super-admin', async () => {
      const gym = await createTestGym();
      const { userId: targetId } = await registerAndLogin('target3@test.com');

      const res = await request(app)
        .patch(`${ADMIN}/gyms/${gym.id}/members/${targetId}/role`)
        .set('Cookie', memberCookie)
        .send({ role: 'admin' });
      expect(res.status).toBe(403);
    });
  });
});
