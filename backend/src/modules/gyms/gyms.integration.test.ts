import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import {
  truncateAll,
  createTestGym,
  makeAdmin,
  makeGymMember,
  registerAndLogin,
  buildJoinQr,
} from '../../test/helpers';

describe('Gyms API', () => {
  beforeEach(() => truncateAll());

  // ── POST /api/gyms/join ─────────────────────────────────────────────────────

  describe('POST /api/gyms/join', () => {
    it('adds the user as a member of the gym', async () => {
      const gym = await createTestGym('Iron Temple');
      const { cookie } = await registerAndLogin('member@example.com');

      const res = await request(app)
        .post('/api/gyms/join')
        .set('Cookie', cookie)
        .send(buildJoinQr(gym.id, gym.joinSecret));

      expect(res.status).toBe(201);
      expect(res.body.gym.id).toBe(gym.id);
      expect(res.body.gym.name).toBe('Iron Temple');
      expect(res.body.gym.role).toBe('member');
    });

    it('is idempotent — joining the same gym twice returns success', async () => {
      const gym = await createTestGym();
      const { cookie } = await registerAndLogin('member2@example.com');
      const payload = buildJoinQr(gym.id, gym.joinSecret);

      await request(app).post('/api/gyms/join').set('Cookie', cookie).send(payload);
      const res = await request(app).post('/api/gyms/join').set('Cookie', cookie).send(payload);

      expect(res.status).toBe(201);
    });

    it('rejects a tampered QR signature with 400', async () => {
      const gym = await createTestGym();
      const { cookie } = await registerAndLogin('member3@example.com');
      const payload = { ...buildJoinQr(gym.id, gym.joinSecret), sig: 'deadbeef'.repeat(8) };

      const res = await request(app).post('/api/gyms/join').set('Cookie', cookie).send(payload);
      expect(res.status).toBe(400);
    });

    it('rejects a QR signed for a different gym with 400', async () => {
      const gymA = await createTestGym('Gym A');
      const gymB = await createTestGym('Gym B');
      const { cookie } = await registerAndLogin('member4@example.com');

      // Send Gym A's QR but the payload says gym_id = gymB — signature won't match
      const crossPayload = { ...buildJoinQr(gymA.id, gymA.joinSecret), gym_id: gymB.id };

      const res = await request(app).post('/api/gyms/join').set('Cookie', cookie).send(crossPayload);
      expect(res.status).toBe(400);
    });

    it('returns 401 when unauthenticated', async () => {
      const gym = await createTestGym();
      const res = await request(app).post('/api/gyms/join').send(buildJoinQr(gym.id, gym.joinSecret));
      expect(res.status).toBe(401);
    });

    it('returns 404 for a QR referencing a non-existent gym', async () => {
      const { cookie } = await registerAndLogin('member5@example.com');
      const fakeId = '00000000-0000-0000-0000-000000000000';
      // Build a structurally valid payload for a gym that doesn't exist
      const payload = buildJoinQr(fakeId, 'any-secret-here');

      const res = await request(app).post('/api/gyms/join').set('Cookie', cookie).send(payload);
      expect(res.status).toBe(404);
    });
  });

  // ── GET /api/gyms/:gymId/members ────────────────────────────────────────────

  describe('GET /api/gyms/:gymId/members', () => {
    it('admin sees all members with membership status', async () => {
      const gym = await createTestGym();
      const { cookie: adminCookie, userId: adminId } = await registerAndLogin('admin@example.com');
      const { userId: memberId } = await registerAndLogin('member@example.com');

      await makeAdmin(adminId, gym.id);
      await makeGymMember(memberId, gym.id);

      const res = await request(app)
        .get(`/api/gyms/${gym.id}/members`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.items.every((m: { membership: unknown }) => m.membership !== undefined)).toBe(true);
    });

    it('returns 403 for a regular gym member', async () => {
      const gym = await createTestGym();
      const { cookie, userId } = await registerAndLogin('member@example.com');
      await makeGymMember(userId, gym.id);

      const res = await request(app).get(`/api/gyms/${gym.id}/members`).set('Cookie', cookie);
      expect(res.status).toBe(403);
    });

    it('returns 404 for a user who is not a member of the gym (avoids leaking gym existence)', async () => {
      const gym = await createTestGym();
      const { cookie } = await registerAndLogin('outsider@example.com');

      const res = await request(app).get(`/api/gyms/${gym.id}/members`).set('Cookie', cookie);
      expect(res.status).toBe(404);
    });

    it('returns 401 when unauthenticated', async () => {
      const gym = await createTestGym();
      const res = await request(app).get(`/api/gyms/${gym.id}/members`);
      expect(res.status).toBe(401);
    });
  });

  // ── Tenancy isolation ───────────────────────────────────────────────────────

  describe('Tenancy isolation', () => {
    it('admin of Gym A cannot see members of Gym B (returns 404, not gym details)', async () => {
      const gymA = await createTestGym('Gym A');
      const gymB = await createTestGym('Gym B');
      const { cookie: adminACookie, userId: adminAId } = await registerAndLogin('admina@example.com');
      await makeAdmin(adminAId, gymA.id);

      const res = await request(app).get(`/api/gyms/${gymB.id}/members`).set('Cookie', adminACookie);
      expect(res.status).toBe(404);
    });
  });
});
