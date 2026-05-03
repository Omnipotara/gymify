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
  buildCheckinQr,
  buildRotatingCheckinQr,
} from '../../test/helpers';

describe('Check-ins API', () => {
  beforeEach(() => truncateAll());

  describe('POST /api/gyms/:gymId/check-ins', () => {
    it('member with active membership checks in via v=1 static QR', async () => {
      const gym = await createTestGym();
      const { cookie, userId } = await registerAndLogin('member@example.com');
      await makeGymMember(userId, gym.id);
      await createActiveMembership(userId, gym.id);

      const res = await request(app)
        .post(`/api/gyms/${gym.id}/check-ins`)
        .set('Cookie', cookie)
        .send(buildCheckinQr(gym.id, gym.checkinSecret));

      expect(res.status).toBe(201);
      expect(res.body.gym_id).toBe(gym.id);
      expect(res.body.user_id).toBe(userId);
    });

    it('member with active membership checks in via v=2 rotating QR', async () => {
      const gym = await createTestGym();
      const { cookie, userId } = await registerAndLogin('member2@example.com');
      await makeGymMember(userId, gym.id);
      await createActiveMembership(userId, gym.id);

      const res = await request(app)
        .post(`/api/gyms/${gym.id}/check-ins`)
        .set('Cookie', cookie)
        .send(buildRotatingCheckinQr(gym.id, gym.checkinSecret));

      expect(res.status).toBe(201);
    });

    it('admin can check in without an active membership', async () => {
      const gym = await createTestGym();
      const { cookie, userId } = await registerAndLogin('admin@example.com');
      await makeAdmin(userId, gym.id);
      // Deliberately no membership created

      const res = await request(app)
        .post(`/api/gyms/${gym.id}/check-ins`)
        .set('Cookie', cookie)
        .send(buildCheckinQr(gym.id, gym.checkinSecret));

      expect(res.status).toBe(201);
    });

    it('rejects a second check-in within 30 minutes with 409', async () => {
      const gym = await createTestGym();
      const { cookie, userId } = await registerAndLogin('member3@example.com');
      await makeGymMember(userId, gym.id);
      await createActiveMembership(userId, gym.id);

      const payload = buildCheckinQr(gym.id, gym.checkinSecret);
      await request(app).post(`/api/gyms/${gym.id}/check-ins`).set('Cookie', cookie).send(payload);
      const res = await request(app).post(`/api/gyms/${gym.id}/check-ins`).set('Cookie', cookie).send(payload);

      expect(res.status).toBe(409);
    });

    it('rejects a member with no active membership with 403', async () => {
      const gym = await createTestGym();
      const { cookie, userId } = await registerAndLogin('expired@example.com');
      await makeGymMember(userId, gym.id);
      // No membership created

      const res = await request(app)
        .post(`/api/gyms/${gym.id}/check-ins`)
        .set('Cookie', cookie)
        .send(buildCheckinQr(gym.id, gym.checkinSecret));

      expect(res.status).toBe(403);
    });

    it('rejects a user who is not a gym member with 404 (avoids leaking gym existence)', async () => {
      const gym = await createTestGym();
      const { cookie } = await registerAndLogin('outsider@example.com');
      // Not added to the gym at all

      const res = await request(app)
        .post(`/api/gyms/${gym.id}/check-ins`)
        .set('Cookie', cookie)
        .send(buildCheckinQr(gym.id, gym.checkinSecret));

      expect(res.status).toBe(404);
    });

    it('rejects a tampered QR signature with 400', async () => {
      const gym = await createTestGym();
      const { cookie, userId } = await registerAndLogin('member4@example.com');
      await makeGymMember(userId, gym.id);
      await createActiveMembership(userId, gym.id);

      const payload = { ...buildCheckinQr(gym.id, gym.checkinSecret), sig: 'deadbeef'.repeat(8) };

      const res = await request(app)
        .post(`/api/gyms/${gym.id}/check-ins`)
        .set('Cookie', cookie)
        .send(payload);

      expect(res.status).toBe(400);
    });

    it('rejects a check-in QR used on the wrong gym endpoint with 400', async () => {
      const gymA = await createTestGym('Gym A');
      const gymB = await createTestGym('Gym B');
      const { cookie, userId } = await registerAndLogin('member5@example.com');
      await makeGymMember(userId, gymA.id);
      await makeGymMember(userId, gymB.id);
      await createActiveMembership(userId, gymA.id);
      await createActiveMembership(userId, gymB.id);

      // Gym A's check-in QR submitted to Gym B's endpoint → gym_id mismatch
      const gymAQr = buildCheckinQr(gymA.id, gymA.checkinSecret);

      const res = await request(app)
        .post(`/api/gyms/${gymB.id}/check-ins`)
        .set('Cookie', cookie)
        .send(gymAQr);

      expect(res.status).toBe(400);
    });

    it('returns 401 when unauthenticated', async () => {
      const gym = await createTestGym();
      const res = await request(app)
        .post(`/api/gyms/${gym.id}/check-ins`)
        .send(buildCheckinQr(gym.id, gym.checkinSecret));
      expect(res.status).toBe(401);
    });
  });

  // ── GET /api/gyms/:gymId/check-ins (admin log) ──────────────────────────────

  describe('GET /api/gyms/:gymId/check-ins', () => {
    it('admin retrieves today\'s check-in log', async () => {
      const gym = await createTestGym();
      const { cookie: adminCookie, userId: adminId } = await registerAndLogin('admin@example.com');
      await makeAdmin(adminId, gym.id);

      // Admin checks in (no membership required)
      await request(app)
        .post(`/api/gyms/${gym.id}/check-ins`)
        .set('Cookie', adminCookie)
        .send(buildCheckinQr(gym.id, gym.checkinSecret));

      const res = await request(app).get(`/api/gyms/${gym.id}/check-ins`).set('Cookie', adminCookie);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.items.length).toBeGreaterThan(0);
    });

    it('returns 403 for a regular member', async () => {
      const gym = await createTestGym();
      const { cookie, userId } = await registerAndLogin('member@example.com');
      await makeGymMember(userId, gym.id);

      const res = await request(app).get(`/api/gyms/${gym.id}/check-ins`).set('Cookie', cookie);
      expect(res.status).toBe(403);
    });
  });
});
