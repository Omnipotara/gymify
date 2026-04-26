import { NotFoundError, ValidationError } from '../../lib/errors';
import * as repo from './rewards.repository';
import type {
  CreateRewardRulePayload,
  MemberReward,
  MemberRewardWithMember,
  RewardRule,
  RewardSummary,
  UpdateRewardRulePayload,
} from './rewards.types';

// ── Rule management ────────────────────────────────────────────────────────────

export async function getRules(gymId: string): Promise<RewardRule[]> {
  return repo.getRules(gymId);
}

export async function createRule(gymId: string, data: CreateRewardRulePayload): Promise<RewardRule> {
  if (!['streak', 'milestone', 'comeback'].includes(data.type)) {
    throw new ValidationError('Invalid reward type');
  }
  if (data.threshold < 0) throw new ValidationError('Threshold must be >= 0');
  if (data.discount_percent < 1 || data.discount_percent > 100) {
    throw new ValidationError('Discount must be between 1 and 100');
  }
  if (!data.description?.trim()) throw new ValidationError('Description is required');
  return repo.createRule(gymId, data);
}

export async function deleteRule(gymId: string, ruleId: string): Promise<void> {
  const deleted = await repo.deleteRule(gymId, ruleId);
  if (!deleted) throw new NotFoundError();
}

export async function updateRule(
  gymId: string,
  ruleId: string,
  patch: UpdateRewardRulePayload,
): Promise<RewardRule> {
  const updated = await repo.updateRule(gymId, ruleId, patch);
  if (!updated) throw new NotFoundError();
  return updated;
}

// ── Reward evaluation (called after every check-in) ───────────────────────────

export async function evaluateRewards(gymId: string, userId: string): Promise<RewardSummary[]> {
  const rules = await repo.getActiveRules(gymId);
  if (rules.length === 0) return [];

  const granted: RewardSummary[] = [];

  for (const rule of rules) {
    if (rule.type === 'milestone') {
      const [totalVisits, earnedCount] = await Promise.all([
        repo.getTotalVisits(gymId, userId),
        repo.getEarnedCount(userId, rule.id),
      ]);
      // Grant once when the milestone is first reached
      if (earnedCount === 0 && totalVisits >= rule.threshold) {
        await repo.grantReward(gymId, userId, rule.id);
        granted.push({ description: rule.description, discount_percent: rule.discount_percent, type: rule.type });
      }
    } else if (rule.type === 'streak') {
      const [streak, earnedCount] = await Promise.all([
        computeStreak(gymId, userId),
        repo.getEarnedCount(userId, rule.id),
      ]);
      // Grant each time the user hits another multiple of the threshold
      if (rule.threshold > 0 && Math.floor(streak / rule.threshold) > earnedCount) {
        await repo.grantReward(gymId, userId, rule.id);
        granted.push({ description: rule.description, discount_percent: rule.discount_percent, type: rule.type });
      }
    } else if (rule.type === 'comeback' && rule.threshold > 0) {
      const prev = await repo.getPreviousCheckIn(gymId, userId);
      if (prev) {
        const gapDays = (Date.now() - new Date(prev.checked_in_at).getTime()) / 86400000;
        if (gapDays >= rule.threshold) {
          // Only grant once per comeback event — not on every subsequent check-in
          const lastEarnedAt = await repo.getLastRewardEarnedAt(userId, rule.id);
          const alreadyGrantedForThisReturn =
            lastEarnedAt && new Date(lastEarnedAt) > new Date(prev.checked_in_at);
          if (!alreadyGrantedForThisReturn) {
            await repo.grantReward(gymId, userId, rule.id);
            granted.push({ description: rule.description, discount_percent: rule.discount_percent, type: rule.type });
          }
        }
      }
    }
  }

  return granted;
}

async function computeStreak(gymId: string, userId: string): Promise<number> {
  const weekStrs = await repo.getQualifyingWeeks(gymId, userId);
  if (weekStrs.length === 0) return 0;

  // Current calendar week Monday (UTC)
  const now = new Date();
  const dow = now.getUTCDay();
  const daysFromMonday = dow === 0 ? 6 : dow - 1;
  const currentWeekMs = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - daysFromMonday,
  );
  const prevWeekMs = currentWeekMs - 7 * 86400000;

  const weekMs = weekStrs.map((s) => new Date(s + 'T00:00:00Z').getTime());

  // If the most recent qualifying week is older than last week, the streak is broken
  if (weekMs[0] < prevWeekMs) return 0;

  let streak = 1;
  for (let i = 1; i < weekMs.length; i++) {
    if (weekMs[i] === weekMs[i - 1] - 7 * 86400000) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

// ── Member view ────────────────────────────────────────────────────────────────

export async function getMyRewards(gymId: string, userId: string): Promise<MemberRewardWithMember[]> {
  return repo.getMyRewards(gymId, userId);
}

// ── Admin view ─────────────────────────────────────────────────────────────────

export async function getAllRewards(gymId: string): Promise<MemberRewardWithMember[]> {
  return repo.getAllRewards(gymId);
}

export async function redeemReward(
  gymId: string,
  rewardId: string,
  adminUserId: string,
): Promise<MemberReward> {
  const reward = await repo.redeemReward(gymId, rewardId, adminUserId);
  if (!reward) throw new NotFoundError('Reward not found or already redeemed');
  return reward;
}
