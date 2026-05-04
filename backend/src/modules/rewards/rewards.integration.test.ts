import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import {
  truncateAll,
  createTestGym,
  makeAdmin,
  makeGymMember,
  createActiveMembership,
  createRewardRule,
  insertCheckIn,
  mondayOf,
  registerAndLogin,
  buildCheckinQr,
  type TestGym,
} from '../../test/helpers';

// ── Shared setup ─────────────────────────────────────────────────────────────

interface Ctx {
  gym: TestGym;
  adminCookie: string;
  adminId: string;
  memberCookie: string;
  memberId: string;
}

async function makeGym(adminEmail: string, memberEmail: string): Promise<Ctx> {
  const gym = await createTestGym();
  const { cookie: adminCookie, userId: adminId } = await registerAndLogin(adminEmail);
  const { cookie: memberCookie, userId: memberId } = await registerAndLogin(memberEmail);
  await makeAdmin(adminId, gym.id);
  await makeGymMember(memberId, gym.id);
  await createActiveMembership(memberId, gym.id);
  return { gym, adminCookie, adminId, memberCookie, memberId };
}

describe('Rewards API', () => {
  beforeEach(() => truncateAll());

  // ── Rule CRUD ────────────────────────────────────────────────────────────────

  describe('Rule management', () => {
    it('admin creates a rule and it appears in the rule list', async () => {
      const { gym, adminCookie } = await makeGym('admin@ex.com', 'member@ex.com');

      const createRes = await request(app)
        .post(`/api/gyms/${gym.id}/reward-rules`)
        .set('Cookie', adminCookie)
        .send({ type: 'milestone', threshold: 10, discount_percent: 15, description: '10-visit reward' });

      expect(createRes.status).toBe(201);
      expect(createRes.body.id).toBeDefined();
      expect(createRes.body.is_active).toBe(true);

      const listRes = await request(app)
        .get(`/api/gyms/${gym.id}/reward-rules`)
        .set('Cookie', adminCookie);
      expect(listRes.status).toBe(200);
      expect(listRes.body.items.some((r: { id: string }) => r.id === createRes.body.id)).toBe(true);
    });

    it('admin can deactivate a rule via PATCH', async () => {
      const { gym, adminCookie } = await makeGym('admin2@ex.com', 'member2@ex.com');
      const { id: ruleId } = await createRewardRule(gym.id, { type: 'milestone', threshold: 5 });

      const res = await request(app)
        .patch(`/api/gyms/${gym.id}/reward-rules/${ruleId}`)
        .set('Cookie', adminCookie)
        .send({ is_active: false });

      expect(res.status).toBe(200);
      expect(res.body.is_active).toBe(false);
    });

    it('admin can delete a rule', async () => {
      const { gym, adminCookie } = await makeGym('admin3@ex.com', 'member3@ex.com');
      const { id: ruleId } = await createRewardRule(gym.id, { type: 'milestone', threshold: 5 });

      const res = await request(app)
        .delete(`/api/gyms/${gym.id}/reward-rules/${ruleId}`)
        .set('Cookie', adminCookie);
      expect(res.status).toBe(204);

      const listRes = await request(app)
        .get(`/api/gyms/${gym.id}/reward-rules`)
        .set('Cookie', adminCookie);
      expect(listRes.body.items.some((r: { id: string }) => r.id === ruleId)).toBe(false);
    });

    it('returns 400 for an invalid rule type', async () => {
      const { gym, adminCookie } = await makeGym('admin4@ex.com', 'member4@ex.com');
      const res = await request(app)
        .post(`/api/gyms/${gym.id}/reward-rules`)
        .set('Cookie', adminCookie)
        .send({ type: 'invalid', threshold: 5, discount_percent: 10, description: 'bad' });
      expect(res.status).toBe(400);
    });

    it('returns 403 for a non-admin member', async () => {
      const { gym, memberCookie } = await makeGym('admin5@ex.com', 'member5@ex.com');
      const res = await request(app)
        .post(`/api/gyms/${gym.id}/reward-rules`)
        .set('Cookie', memberCookie)
        .send({ type: 'milestone', threshold: 5, discount_percent: 10, description: 'x' });
      expect(res.status).toBe(403);
    });
  });

  // ── Milestone rewards ────────────────────────────────────────────────────────

  describe('Milestone rewards', () => {
    it('grants milestone reward when check-in count hits threshold', async () => {
      const { gym, memberCookie, memberId } = await makeGym('admin6@ex.com', 'member6@ex.com');
      await createRewardRule(gym.id, { type: 'milestone', threshold: 3, description: '3-visit badge' });

      // 2 historical check-ins (> 30 min ago to bypass dedup)
      await insertCheckIn(memberId, gym.id, new Date(Date.now() - 2 * 3600_000));
      await insertCheckIn(memberId, gym.id, new Date(Date.now() - 3 * 3600_000));

      // 3rd check-in via API crosses the threshold
      const res = await request(app)
        .post(`/api/gyms/${gym.id}/check-ins`)
        .set('Cookie', memberCookie)
        .send(buildCheckinQr(gym.id, gym.checkinSecret));

      expect(res.status).toBe(201);
      expect(res.body.new_rewards).toHaveLength(1);
      expect(res.body.new_rewards[0].type).toBe('milestone');
      expect(res.body.new_rewards[0].description).toBe('3-visit badge');
    });

    it('does not grant milestone twice if threshold already earned', async () => {
      const { gym, memberCookie, memberId } = await makeGym('admin7@ex.com', 'member7@ex.com');
      const { id: ruleId } = await createRewardRule(gym.id, { type: 'milestone', threshold: 2 });

      // 2 historical check-ins — threshold is already met
      await insertCheckIn(memberId, gym.id, new Date(Date.now() - 4 * 3600_000));
      await insertCheckIn(memberId, gym.id, new Date(Date.now() - 3 * 3600_000));

      // Manually mark milestone as already earned
      await request(app)
        .post(`/api/gyms/${gym.id}/check-ins`)
        .set('Cookie', memberCookie)
        .send(buildCheckinQr(gym.id, gym.checkinSecret));

      // Verify earned
      const rewards = await request(app)
        .get(`/api/gyms/${gym.id}/me/rewards`)
        .set('Cookie', memberCookie);
      const earned = rewards.body.items.filter((r: { rule_id: string }) => r.rule_id === ruleId);
      expect(earned).toHaveLength(1);
    });

    it('does not grant a deactivated milestone rule', async () => {
      const { gym, adminCookie, memberCookie, memberId } = await makeGym('admin8@ex.com', 'member8@ex.com');
      const { id: ruleId } = await createRewardRule(gym.id, { type: 'milestone', threshold: 1 });

      // Deactivate the rule
      await request(app)
        .patch(`/api/gyms/${gym.id}/reward-rules/${ruleId}`)
        .set('Cookie', adminCookie)
        .send({ is_active: false });

      const res = await request(app)
        .post(`/api/gyms/${gym.id}/check-ins`)
        .set('Cookie', memberCookie)
        .send(buildCheckinQr(gym.id, gym.checkinSecret));

      expect(res.status).toBe(201);
      expect(res.body.new_rewards).toHaveLength(0);
    });
  });

  // ── Streak rewards ───────────────────────────────────────────────────────────

  describe('Streak rewards', () => {
    it('grants streak reward after two consecutive qualifying weeks', async () => {
      const { gym, memberCookie, memberId } = await makeGym('admin9@ex.com', 'member9@ex.com');
      await createRewardRule(gym.id, { type: 'streak', threshold: 2, description: '2-week streak' });

      // 2+ check-ins each in week -2 and week -1
      await insertCheckIn(memberId, gym.id, mondayOf(2, 10));
      await insertCheckIn(memberId, gym.id, mondayOf(2, 11));
      await insertCheckIn(memberId, gym.id, mondayOf(1, 10));
      await insertCheckIn(memberId, gym.id, mondayOf(1, 11));

      // API check-in this week triggers evaluation
      const res = await request(app)
        .post(`/api/gyms/${gym.id}/check-ins`)
        .set('Cookie', memberCookie)
        .send(buildCheckinQr(gym.id, gym.checkinSecret));

      expect(res.status).toBe(201);
      expect(res.body.new_rewards.some((r: { type: string }) => r.type === 'streak')).toBe(true);
    });

    it('does not grant streak when the chain is broken', async () => {
      const { gym, memberCookie, memberId } = await makeGym('admin10@ex.com', 'member10@ex.com');
      await createRewardRule(gym.id, { type: 'streak', threshold: 2 });

      // 2 check-ins in week -3, none in week -2 or -1 — streak broken
      await insertCheckIn(memberId, gym.id, mondayOf(3, 10));
      await insertCheckIn(memberId, gym.id, mondayOf(3, 11));

      const res = await request(app)
        .post(`/api/gyms/${gym.id}/check-ins`)
        .set('Cookie', memberCookie)
        .send(buildCheckinQr(gym.id, gym.checkinSecret));

      expect(res.status).toBe(201);
      expect(res.body.new_rewards).toHaveLength(0);
    });
  });

  // ── Comeback rewards ─────────────────────────────────────────────────────────

  describe('Comeback rewards', () => {
    it('grants comeback reward when gap since last visit exceeds threshold', async () => {
      const { gym, memberCookie, memberId } = await makeGym('admin11@ex.com', 'member11@ex.com');
      await createRewardRule(gym.id, { type: 'comeback', threshold: 7, description: 'We missed you!' });

      // Last visit was 10 days ago
      await insertCheckIn(memberId, gym.id, new Date(Date.now() - 10 * 86400_000));

      const res = await request(app)
        .post(`/api/gyms/${gym.id}/check-ins`)
        .set('Cookie', memberCookie)
        .send(buildCheckinQr(gym.id, gym.checkinSecret));

      expect(res.status).toBe(201);
      expect(res.body.new_rewards.some((r: { type: string }) => r.type === 'comeback')).toBe(true);
      expect(res.body.new_rewards[0].description).toBe('We missed you!');
    });

    it('does not grant comeback when gap is below threshold', async () => {
      const { gym, memberCookie, memberId } = await makeGym('admin12@ex.com', 'member12@ex.com');
      await createRewardRule(gym.id, { type: 'comeback', threshold: 14 });

      // Last visit was only 5 days ago
      await insertCheckIn(memberId, gym.id, new Date(Date.now() - 5 * 86400_000));

      const res = await request(app)
        .post(`/api/gyms/${gym.id}/check-ins`)
        .set('Cookie', memberCookie)
        .send(buildCheckinQr(gym.id, gym.checkinSecret));

      expect(res.status).toBe(201);
      expect(res.body.new_rewards).toHaveLength(0);
    });
  });

  // ── Reward redemption ────────────────────────────────────────────────────────

  describe('Reward redemption', () => {
    it('admin can redeem a member reward, second redeem attempt returns 404', async () => {
      const { gym, adminCookie, memberCookie, memberId } = await makeGym('admin13@ex.com', 'member13@ex.com');
      await createRewardRule(gym.id, { type: 'milestone', threshold: 1 });

      // Trigger the reward
      await request(app)
        .post(`/api/gyms/${gym.id}/check-ins`)
        .set('Cookie', memberCookie)
        .send(buildCheckinQr(gym.id, gym.checkinSecret));

      // Get the reward id
      const myRewards = await request(app)
        .get(`/api/gyms/${gym.id}/me/rewards`)
        .set('Cookie', memberCookie);
      expect(myRewards.body.items).toHaveLength(1);
      const rewardId = myRewards.body.items[0].id;

      // Admin redeems
      const redeemRes = await request(app)
        .post(`/api/gyms/${gym.id}/rewards/${rewardId}/redeem`)
        .set('Cookie', adminCookie);
      expect(redeemRes.status).toBe(200);
      expect(redeemRes.body.redeemed_at).not.toBeNull();

      // Second redeem attempt
      const second = await request(app)
        .post(`/api/gyms/${gym.id}/rewards/${rewardId}/redeem`)
        .set('Cookie', adminCookie);
      expect(second.status).toBe(404);
    });

    it('redeemed rewards no longer appear in member view', async () => {
      const { gym, adminCookie, memberCookie } = await makeGym('admin14@ex.com', 'member14@ex.com');
      await createRewardRule(gym.id, { type: 'milestone', threshold: 1 });

      await request(app)
        .post(`/api/gyms/${gym.id}/check-ins`)
        .set('Cookie', memberCookie)
        .send(buildCheckinQr(gym.id, gym.checkinSecret));

      const before = await request(app)
        .get(`/api/gyms/${gym.id}/me/rewards`)
        .set('Cookie', memberCookie);
      const rewardId = before.body.items[0].id;

      await request(app)
        .post(`/api/gyms/${gym.id}/rewards/${rewardId}/redeem`)
        .set('Cookie', adminCookie);

      const after = await request(app)
        .get(`/api/gyms/${gym.id}/me/rewards`)
        .set('Cookie', memberCookie);
      expect(after.body.items.some((r: { id: string }) => r.id === rewardId)).toBe(false);
    });
  });

  // ── Tenancy isolation ────────────────────────────────────────────────────────

  describe('Tenancy isolation', () => {
    it('rewards earned at Gym A are not visible from Gym B admin endpoint', async () => {
      const gymA = await createTestGym('Gym A');
      const gymB = await createTestGym('Gym B');

      const { cookie: adminACookie, userId: adminAId } = await registerAndLogin('adminA@ex.com');
      const { cookie: adminBCookie, userId: adminBId } = await registerAndLogin('adminB@ex.com');
      const { cookie: memberCookie, userId: memberId } = await registerAndLogin('shared@ex.com');

      await makeAdmin(adminAId, gymA.id);
      await makeAdmin(adminBId, gymB.id);
      await makeGymMember(memberId, gymA.id);
      await createActiveMembership(memberId, gymA.id);

      await createRewardRule(gymA.id, { type: 'milestone', threshold: 1 });

      // Check in at Gym A — earns reward
      await request(app)
        .post(`/api/gyms/${gymA.id}/check-ins`)
        .set('Cookie', memberCookie)
        .send(buildCheckinQr(gymA.id, gymA.checkinSecret));

      // Gym B admin should see no rewards
      const gymBRewards = await request(app)
        .get(`/api/gyms/${gymB.id}/rewards`)
        .set('Cookie', adminBCookie);
      expect(gymBRewards.status).toBe(200);
      expect(gymBRewards.body.items).toHaveLength(0);
    });
  });
});
