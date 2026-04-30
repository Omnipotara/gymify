import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./rewards.repository');

import * as repo from './rewards.repository';
import { evaluateRewards } from './rewards.service';
import type { RewardRule, MemberReward } from './rewards.types';

const GYM_ID = 'gym-1';
const USER_ID = 'user-1';

// Returns the ISO date string for the Monday of the week N weeks ago (UTC)
function weekOf(weeksAgo: number): string {
  const now = new Date();
  const dow = now.getUTCDay();
  const daysFromMonday = dow === 0 ? 6 : dow - 1;
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysFromMonday - weeksAgo * 7),
  );
  return monday.toISOString().slice(0, 10);
}

function makeRule(overrides: Partial<RewardRule>): RewardRule {
  return {
    id: 'rule-1',
    gym_id: GYM_ID,
    type: 'milestone',
    threshold: 10,
    discount_percent: 10,
    description: 'Test reward',
    is_active: true,
    created_at: new Date(),
    ...overrides,
  };
}

const mockGranted: MemberReward = {
  id: 'mr-1',
  user_id: USER_ID,
  gym_id: GYM_ID,
  rule_id: 'rule-1',
  earned_at: new Date(),
  redeemed_at: null,
  redeemed_by: null,
};

beforeEach(() => vi.clearAllMocks());

// ── General ────────────────────────────────────────────────────────────────────

describe('evaluateRewards — general', () => {
  it('returns an empty array and skips all other queries when there are no active rules', async () => {
    vi.mocked(repo.getActiveRules).mockResolvedValue([]);

    const result = await evaluateRewards(GYM_ID, USER_ID);

    expect(result).toEqual([]);
    expect(repo.getTotalVisits).not.toHaveBeenCalled();
    expect(repo.getEarnedCount).not.toHaveBeenCalled();
    expect(repo.grantReward).not.toHaveBeenCalled();
  });

  it('returns summaries for all rules that trigger in the same call', async () => {
    const milestoneRule = makeRule({ id: 'rule-1', type: 'milestone', threshold: 5 });
    const streakRule = makeRule({ id: 'rule-2', type: 'streak', threshold: 2 });
    vi.mocked(repo.getActiveRules).mockResolvedValue([milestoneRule, streakRule]);
    vi.mocked(repo.getTotalVisits).mockResolvedValue(5);
    vi.mocked(repo.getEarnedCount).mockResolvedValue(0);
    vi.mocked(repo.getQualifyingWeeks).mockResolvedValue([weekOf(0), weekOf(1)]);
    vi.mocked(repo.grantReward).mockResolvedValue(mockGranted);

    const result = await evaluateRewards(GYM_ID, USER_ID);

    expect(result).toHaveLength(2);
    expect(repo.grantReward).toHaveBeenCalledTimes(2);
  });
});

// ── Milestone ──────────────────────────────────────────────────────────────────

describe('evaluateRewards — milestone rule', () => {
  it('grants the reward the first time the visit threshold is reached', async () => {
    vi.mocked(repo.getActiveRules).mockResolvedValue([makeRule({ threshold: 10 })]);
    vi.mocked(repo.getTotalVisits).mockResolvedValue(10);
    vi.mocked(repo.getEarnedCount).mockResolvedValue(0);
    vi.mocked(repo.grantReward).mockResolvedValue(mockGranted);

    const result = await evaluateRewards(GYM_ID, USER_ID);

    expect(result).toHaveLength(1);
    expect(result[0].description).toBe('Test reward');
    expect(repo.grantReward).toHaveBeenCalledOnce();
  });

  it('does not grant again when the reward has already been earned', async () => {
    vi.mocked(repo.getActiveRules).mockResolvedValue([makeRule({ threshold: 10 })]);
    vi.mocked(repo.getTotalVisits).mockResolvedValue(15);
    vi.mocked(repo.getEarnedCount).mockResolvedValue(1); // already earned once

    const result = await evaluateRewards(GYM_ID, USER_ID);

    expect(result).toEqual([]);
    expect(repo.grantReward).not.toHaveBeenCalled();
  });

  it('does not grant when visits are below the threshold', async () => {
    vi.mocked(repo.getActiveRules).mockResolvedValue([makeRule({ threshold: 10 })]);
    vi.mocked(repo.getTotalVisits).mockResolvedValue(9);
    vi.mocked(repo.getEarnedCount).mockResolvedValue(0);

    const result = await evaluateRewards(GYM_ID, USER_ID);

    expect(result).toEqual([]);
    expect(repo.grantReward).not.toHaveBeenCalled();
  });
});

// ── Streak ─────────────────────────────────────────────────────────────────────

describe('evaluateRewards — streak rule', () => {
  it('grants when consecutive weeks equal the threshold', async () => {
    vi.mocked(repo.getActiveRules).mockResolvedValue([makeRule({ type: 'streak', threshold: 3 })]);
    vi.mocked(repo.getQualifyingWeeks).mockResolvedValue([weekOf(0), weekOf(1), weekOf(2)]);
    vi.mocked(repo.getEarnedCount).mockResolvedValue(0);
    vi.mocked(repo.grantReward).mockResolvedValue(mockGranted);

    const result = await evaluateRewards(GYM_ID, USER_ID);

    expect(result).toHaveLength(1);
    expect(repo.grantReward).toHaveBeenCalledOnce();
  });

  it('grants again when streak crosses the next multiple of the threshold', async () => {
    vi.mocked(repo.getActiveRules).mockResolvedValue([makeRule({ type: 'streak', threshold: 3 })]);
    vi.mocked(repo.getQualifyingWeeks).mockResolvedValue([
      weekOf(0), weekOf(1), weekOf(2), weekOf(3), weekOf(4), weekOf(5),
    ]); // 6-week streak → floor(6/3) = 2
    vi.mocked(repo.getEarnedCount).mockResolvedValue(1); // earned once already
    vi.mocked(repo.grantReward).mockResolvedValue(mockGranted);

    const result = await evaluateRewards(GYM_ID, USER_ID);

    expect(result).toHaveLength(1);
  });

  it('does not grant when already earned at the current multiple', async () => {
    vi.mocked(repo.getActiveRules).mockResolvedValue([makeRule({ type: 'streak', threshold: 3 })]);
    vi.mocked(repo.getQualifyingWeeks).mockResolvedValue([weekOf(0), weekOf(1), weekOf(2)]);
    vi.mocked(repo.getEarnedCount).mockResolvedValue(1); // floor(3/3) = 1, already earned

    const result = await evaluateRewards(GYM_ID, USER_ID);

    expect(result).toEqual([]);
    expect(repo.grantReward).not.toHaveBeenCalled();
  });

  it('counts only up to the first gap in consecutive weeks', async () => {
    vi.mocked(repo.getActiveRules).mockResolvedValue([makeRule({ type: 'streak', threshold: 3 })]);
    // Week 0 (this week) and week 2 (2 weeks ago) — week 1 is missing
    vi.mocked(repo.getQualifyingWeeks).mockResolvedValue([weekOf(0), weekOf(2)]);
    vi.mocked(repo.getEarnedCount).mockResolvedValue(0);

    const result = await evaluateRewards(GYM_ID, USER_ID);

    // Streak = 1 (break after this week), floor(1/3) = 0, not > earnedCount (0)
    expect(result).toEqual([]);
    expect(repo.grantReward).not.toHaveBeenCalled();
  });

  it('returns streak 0 when the most recent qualifying week is older than last week', async () => {
    vi.mocked(repo.getActiveRules).mockResolvedValue([makeRule({ type: 'streak', threshold: 1 })]);
    // Both weeks are from 2+ weeks ago — streak is broken
    vi.mocked(repo.getQualifyingWeeks).mockResolvedValue([weekOf(2), weekOf(3)]);
    vi.mocked(repo.getEarnedCount).mockResolvedValue(0);

    const result = await evaluateRewards(GYM_ID, USER_ID);

    expect(result).toEqual([]);
    expect(repo.grantReward).not.toHaveBeenCalled();
  });

  it('does not grant when there are no qualifying weeks', async () => {
    vi.mocked(repo.getActiveRules).mockResolvedValue([makeRule({ type: 'streak', threshold: 1 })]);
    vi.mocked(repo.getQualifyingWeeks).mockResolvedValue([]);
    vi.mocked(repo.getEarnedCount).mockResolvedValue(0);

    const result = await evaluateRewards(GYM_ID, USER_ID);

    expect(result).toEqual([]);
    expect(repo.grantReward).not.toHaveBeenCalled();
  });

  it('skips a streak rule with threshold 0', async () => {
    vi.mocked(repo.getActiveRules).mockResolvedValue([makeRule({ type: 'streak', threshold: 0 })]);
    vi.mocked(repo.getQualifyingWeeks).mockResolvedValue([weekOf(0), weekOf(1)]);
    vi.mocked(repo.getEarnedCount).mockResolvedValue(0);

    const result = await evaluateRewards(GYM_ID, USER_ID);

    expect(result).toEqual([]);
    expect(repo.grantReward).not.toHaveBeenCalled();
  });
});

// ── Comeback ───────────────────────────────────────────────────────────────────

describe('evaluateRewards — comeback rule', () => {
  const comebackRule = makeRule({ type: 'comeback', threshold: 14 });

  it('grants when the gap since last visit meets the threshold', async () => {
    const prevCheckIn = {
      id: 'ci-prev',
      user_id: USER_ID,
      gym_id: GYM_ID,
      checked_in_at: new Date(Date.now() - 20 * 86_400_000), // 20 days ago
    };
    vi.mocked(repo.getActiveRules).mockResolvedValue([comebackRule]);
    vi.mocked(repo.getPreviousCheckIn).mockResolvedValue(prevCheckIn);
    vi.mocked(repo.getLastRewardEarnedAt).mockResolvedValue(null);
    vi.mocked(repo.grantReward).mockResolvedValue(mockGranted);

    const result = await evaluateRewards(GYM_ID, USER_ID);

    expect(result).toHaveLength(1);
    expect(repo.grantReward).toHaveBeenCalledOnce();
  });

  it('does not grant when the gap is below the threshold', async () => {
    const prevCheckIn = {
      id: 'ci-prev',
      user_id: USER_ID,
      gym_id: GYM_ID,
      checked_in_at: new Date(Date.now() - 10 * 86_400_000), // only 10 days ago
    };
    vi.mocked(repo.getActiveRules).mockResolvedValue([comebackRule]);
    vi.mocked(repo.getPreviousCheckIn).mockResolvedValue(prevCheckIn);

    const result = await evaluateRewards(GYM_ID, USER_ID);

    expect(result).toEqual([]);
    expect(repo.grantReward).not.toHaveBeenCalled();
  });

  it('does not grant again when already rewarded after the comeback visit', async () => {
    const prevCheckIn = {
      id: 'ci-prev',
      user_id: USER_ID,
      gym_id: GYM_ID,
      checked_in_at: new Date(Date.now() - 20 * 86_400_000), // 20 days ago
    };
    const lastEarnedAt = new Date(Date.now() - 5 * 86_400_000); // earned 5 days ago (after comeback)

    vi.mocked(repo.getActiveRules).mockResolvedValue([comebackRule]);
    vi.mocked(repo.getPreviousCheckIn).mockResolvedValue(prevCheckIn);
    vi.mocked(repo.getLastRewardEarnedAt).mockResolvedValue(lastEarnedAt);

    const result = await evaluateRewards(GYM_ID, USER_ID);

    expect(result).toEqual([]);
    expect(repo.grantReward).not.toHaveBeenCalled();
  });

  it('does not grant when there is no previous check-in (first visit)', async () => {
    vi.mocked(repo.getActiveRules).mockResolvedValue([comebackRule]);
    vi.mocked(repo.getPreviousCheckIn).mockResolvedValue(null);

    const result = await evaluateRewards(GYM_ID, USER_ID);

    expect(result).toEqual([]);
    expect(repo.grantReward).not.toHaveBeenCalled();
  });

  it('skips a comeback rule with threshold 0', async () => {
    vi.mocked(repo.getActiveRules).mockResolvedValue([makeRule({ type: 'comeback', threshold: 0 })]);
    vi.mocked(repo.getPreviousCheckIn).mockResolvedValue({
      id: 'ci-prev',
      user_id: USER_ID,
      gym_id: GYM_ID,
      checked_in_at: new Date(Date.now() - 30 * 86_400_000),
    });

    const result = await evaluateRewards(GYM_ID, USER_ID);

    expect(result).toEqual([]);
    expect(repo.grantReward).not.toHaveBeenCalled();
  });

  it('grants when the gap is exactly at the threshold (>= not >)', async () => {
    vi.useFakeTimers();
    const THRESHOLD = 14;
    const now = Date.now();
    vi.mocked(repo.getActiveRules).mockResolvedValue([makeRule({ type: 'comeback', threshold: THRESHOLD })]);
    vi.mocked(repo.getPreviousCheckIn).mockResolvedValue({
      id: 'ci-prev',
      user_id: USER_ID,
      gym_id: GYM_ID,
      checked_in_at: new Date(now - THRESHOLD * 86_400_000), // exactly 14 days ago
    });
    vi.mocked(repo.getLastRewardEarnedAt).mockResolvedValue(null);
    vi.mocked(repo.grantReward).mockResolvedValue(mockGranted);

    const result = await evaluateRewards(GYM_ID, USER_ID);

    expect(result).toHaveLength(1);
    vi.useRealTimers();
  });
});

// ── Milestone — single-grant semantics ────────────────────────────────────────

describe('evaluateRewards — milestone single-grant semantics', () => {
  it('does not re-grant at 2x the threshold — milestone rewards are one-time only', async () => {
    vi.mocked(repo.getActiveRules).mockResolvedValue([makeRule({ threshold: 10 })]);
    vi.mocked(repo.getTotalVisits).mockResolvedValue(20); // 2× threshold
    vi.mocked(repo.getEarnedCount).mockResolvedValue(1);  // already granted once

    const result = await evaluateRewards(GYM_ID, USER_ID);

    expect(result).toEqual([]);
    expect(repo.grantReward).not.toHaveBeenCalled();
  });

  it('grants on first visit that hits the threshold, not before', async () => {
    vi.mocked(repo.getActiveRules).mockResolvedValue([makeRule({ threshold: 10 })]);
    vi.mocked(repo.getEarnedCount).mockResolvedValue(0);

    // One below the threshold — no grant
    vi.mocked(repo.getTotalVisits).mockResolvedValue(9);
    expect(await evaluateRewards(GYM_ID, USER_ID)).toEqual([]);

    // Exactly at the threshold — grants
    vi.mocked(repo.getTotalVisits).mockResolvedValue(10);
    vi.mocked(repo.grantReward).mockResolvedValue(mockGranted);
    expect(await evaluateRewards(GYM_ID, USER_ID)).toHaveLength(1);
  });
});

// ── grantReward failure propagation ───────────────────────────────────────────

describe('evaluateRewards — grantReward DB failure', () => {
  it('propagates grantReward errors (callers like checkIn are responsible for swallowing)', async () => {
    vi.mocked(repo.getActiveRules).mockResolvedValue([makeRule({ type: 'milestone', threshold: 5 })]);
    vi.mocked(repo.getTotalVisits).mockResolvedValue(5);
    vi.mocked(repo.getEarnedCount).mockResolvedValue(0);
    vi.mocked(repo.grantReward).mockRejectedValue(new Error('DB write failed'));

    await expect(evaluateRewards(GYM_ID, USER_ID)).rejects.toThrow('DB write failed');
  });
});

// ── Rule management validation ─────────────────────────────────────────────────

import { createRule, deleteRule, redeemReward } from './rewards.service';
import { ValidationError, NotFoundError } from '../../lib/errors';

describe('createRule — input validation', () => {
  const validPayload = {
    type: 'milestone' as const,
    threshold: 10,
    discount_percent: 15,
    description: 'Visit 10 times',
  };

  it('throws ValidationError for an unknown rule type', async () => {
    await expect(createRule(GYM_ID, { ...validPayload, type: 'unknown' as never }))
      .rejects.toThrow(ValidationError);
  });

  it('throws ValidationError when threshold is negative', async () => {
    await expect(createRule(GYM_ID, { ...validPayload, threshold: -1 }))
      .rejects.toThrow(ValidationError);
  });

  it('accepts threshold of 0 (valid — streak/milestone with 0 is a no-op but valid to create)', async () => {
    vi.mocked(repo.createRule).mockResolvedValue(makeRule({ threshold: 0 }));
    await expect(createRule(GYM_ID, { ...validPayload, threshold: 0 })).resolves.toBeDefined();
  });

  it('throws ValidationError when discount_percent is 0', async () => {
    await expect(createRule(GYM_ID, { ...validPayload, discount_percent: 0 }))
      .rejects.toThrow(ValidationError);
  });

  it('throws ValidationError when discount_percent exceeds 100', async () => {
    await expect(createRule(GYM_ID, { ...validPayload, discount_percent: 101 }))
      .rejects.toThrow(ValidationError);
  });

  it('accepts discount_percent at the boundaries (1 and 100)', async () => {
    vi.mocked(repo.createRule).mockResolvedValue(makeRule({ discount_percent: 1 }));
    await expect(createRule(GYM_ID, { ...validPayload, discount_percent: 1 })).resolves.toBeDefined();

    vi.mocked(repo.createRule).mockResolvedValue(makeRule({ discount_percent: 100 }));
    await expect(createRule(GYM_ID, { ...validPayload, discount_percent: 100 })).resolves.toBeDefined();
  });

  it('throws ValidationError when description is empty', async () => {
    await expect(createRule(GYM_ID, { ...validPayload, description: '' }))
      .rejects.toThrow(ValidationError);
  });

  it('throws ValidationError when description is whitespace only', async () => {
    await expect(createRule(GYM_ID, { ...validPayload, description: '   ' }))
      .rejects.toThrow(ValidationError);
  });
});

describe('deleteRule', () => {
  it('throws NotFoundError when the rule does not exist', async () => {
    vi.mocked(repo.deleteRule).mockResolvedValue(false);
    await expect(deleteRule(GYM_ID, 'nonexistent')).rejects.toThrow(NotFoundError);
  });

  it('resolves without error when the rule exists', async () => {
    vi.mocked(repo.deleteRule).mockResolvedValue(true);
    await expect(deleteRule(GYM_ID, 'rule-1')).resolves.toBeUndefined();
  });
});

describe('redeemReward', () => {
  it('throws NotFoundError when the reward does not exist or is already redeemed', async () => {
    vi.mocked(repo.redeemReward).mockResolvedValue(null);
    await expect(redeemReward(GYM_ID, 'nonexistent', 'admin-1')).rejects.toThrow(NotFoundError);
  });
});
