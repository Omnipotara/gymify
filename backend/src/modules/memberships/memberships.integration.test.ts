import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import {
  truncateAll,
  createTestGym,
  makeAdmin,
  makeGymMember,
  createActiveMembership,
  registerAndLogin,
} from '../../test/helpers';

describe('Memberships API', () => {
  beforeEach(() => truncateAll());

  // ── POST /memberships ────────────────────────────────────────────────────────

  describe('POST /api/gyms/:gymId/memberships', () => {
    it('admin creates a membership for a gym member', async () => {
      const gym = await createTestGym();
      const { cookie: adminCookie, userId: adminId } = await registerAndLogin('admin@example.com');
      const { userId: memberId } = await registerAndLogin('member@example.com');

      await makeAdmin(adminId, gym.id);
      await makeGymMember(memberId, gym.id);

      const res = await request(app)
        .post(`/api/gyms/${gym.id}/memberships`)
        .set('Cookie', adminCookie)
        .send({ user_id: memberId, start_date: '2026-05-01', end_date: '2026-06-01' });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.start_date).toBe('2026-05-01');
      expect(res.body.end_date).toBe('2026-06-01');
      expect(res.body.status).toBeDefined();
    });

    it('returns 403 for a regular member', async () => {
      const gym = await createTestGym();
      const { cookie, userId } = await registerAndLogin('member@example.com');
      const { userId: otherId } = await registerAndLogin('other@example.com');
      await makeGymMember(userId, gym.id);
      await makeGymMember(otherId, gym.id);

      const res = await request(app)
        .post(`/api/gyms/${gym.id}/memberships`)
        .set('Cookie', cookie)
        .send({ user_id: otherId, start_date: '2026-05-01', end_date: '2026-06-01' });

      expect(res.status).toBe(403);
    });

    it('returns 401 when unauthenticated', async () => {
      const gym = await createTestGym();
      const res = await request(app)
        .post(`/api/gyms/${gym.id}/memberships`)
        .send({ user_id: 'some-id', start_date: '2026-05-01', end_date: '2026-06-01' });
      expect(res.status).toBe(401);
    });

    it('returns 400 when end_date is before start_date', async () => {
      const gym = await createTestGym();
      const { cookie: adminCookie, userId: adminId } = await registerAndLogin('admin@example.com');
      const { userId: memberId } = await registerAndLogin('member@example.com');
      await makeAdmin(adminId, gym.id);
      await makeGymMember(memberId, gym.id);

      const res = await request(app)
        .post(`/api/gyms/${gym.id}/memberships`)
        .set('Cookie', adminCookie)
        .send({ user_id: memberId, start_date: '2026-06-01', end_date: '2026-05-01' });

      expect(res.status).toBe(400);
    });
  });

  // ── PATCH /memberships/:membershipId ─────────────────────────────────────────

  describe('PATCH /api/gyms/:gymId/memberships/:membershipId', () => {
    it('admin updates membership dates', async () => {
      const gym = await createTestGym();
      const { cookie: adminCookie, userId: adminId } = await registerAndLogin('admin@example.com');
      const { userId: memberId } = await registerAndLogin('member@example.com');
      await makeAdmin(adminId, gym.id);
      await makeGymMember(memberId, gym.id);
      const { id: membershipId } = await createActiveMembership(memberId, gym.id);

      const res = await request(app)
        .patch(`/api/gyms/${gym.id}/memberships/${membershipId}`)
        .set('Cookie', adminCookie)
        .send({ start_date: '2026-04-01', end_date: '2026-07-01' });

      expect(res.status).toBe(200);
      expect(res.body.end_date).toBe('2026-07-01');
    });

    it('returns 404 for a membership that belongs to a different gym', async () => {
      const gymA = await createTestGym('Gym A');
      const gymB = await createTestGym('Gym B');
      const { cookie: adminACookie, userId: adminAId } = await registerAndLogin('admina@example.com');
      const { userId: memberId } = await registerAndLogin('member@example.com');
      await makeAdmin(adminAId, gymA.id);
      await makeGymMember(memberId, gymB.id);
      const { id: membershipId } = await createActiveMembership(memberId, gymB.id);

      // Admin of Gym A tries to patch Gym B's membership via Gym A's endpoint
      const res = await request(app)
        .patch(`/api/gyms/${gymA.id}/memberships/${membershipId}`)
        .set('Cookie', adminACookie)
        .send({ start_date: '2026-04-01', end_date: '2026-07-01' });

      expect(res.status).toBe(404);
    });
  });

  // ── POST /memberships/end ────────────────────────────────────────────────────

  describe('POST /api/gyms/:gymId/memberships/end', () => {
    it('admin ends all active memberships for a user', async () => {
      const gym = await createTestGym();
      const { cookie: adminCookie, userId: adminId } = await registerAndLogin('admin@example.com');
      const { userId: memberId } = await registerAndLogin('member@example.com');
      await makeAdmin(adminId, gym.id);
      await makeGymMember(memberId, gym.id);
      await createActiveMembership(memberId, gym.id);

      const endRes = await request(app)
        .post(`/api/gyms/${gym.id}/memberships/end`)
        .set('Cookie', adminCookie)
        .send({ user_id: memberId });

      expect(endRes.status).toBe(204);

      // Verify the membership status is now expired
      const meRes = await request(app)
        .get(`/api/gyms/${gym.id}/members`)
        .set('Cookie', adminCookie);

      const memberRow = meRes.body.items.find((m: { id: string }) => m.id === memberId);
      expect(memberRow.membership.status).toBe('expired');
    });

    it('returns 403 for a regular member', async () => {
      const gym = await createTestGym();
      const { cookie, userId } = await registerAndLogin('member@example.com');
      const { userId: otherId } = await registerAndLogin('other@example.com');
      await makeGymMember(userId, gym.id);
      await makeGymMember(otherId, gym.id);

      const res = await request(app)
        .post(`/api/gyms/${gym.id}/memberships/end`)
        .set('Cookie', cookie)
        .send({ user_id: otherId });

      expect(res.status).toBe(403);
    });
  });

  // ── GET /me/membership ───────────────────────────────────────────────────────

  describe('GET /api/gyms/:gymId/me/membership', () => {
    it('returns active membership status for the authenticated member', async () => {
      const gym = await createTestGym();
      const { cookie, userId } = await registerAndLogin('member@example.com');
      await makeGymMember(userId, gym.id);
      await createActiveMembership(userId, gym.id);

      const res = await request(app).get(`/api/gyms/${gym.id}/me/membership`).set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('active');
    });

    it('returns none status when no membership exists', async () => {
      const gym = await createTestGym();
      const { cookie, userId } = await registerAndLogin('member@example.com');
      await makeGymMember(userId, gym.id);

      const res = await request(app).get(`/api/gyms/${gym.id}/me/membership`).set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('none');
    });
  });
});
