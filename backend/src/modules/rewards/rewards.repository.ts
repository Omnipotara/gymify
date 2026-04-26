import { query } from '../../db/client';
import type { CheckIn } from '../checkins/checkins.types';
import type {
  CreateRewardRulePayload,
  MemberReward,
  MemberRewardWithMember,
  RewardRule,
  UpdateRewardRulePayload,
} from './rewards.types';

// ── Rules ──────────────────────────────────────────────────────────────────────

export async function getRules(gymId: string): Promise<RewardRule[]> {
  const { rows } = await query<RewardRule>(
    `SELECT id, gym_id, type, threshold, discount_percent, description, is_active, created_at
     FROM reward_rules WHERE gym_id = $1 ORDER BY created_at ASC`,
    [gymId],
  );
  return rows;
}

export async function getActiveRules(gymId: string): Promise<RewardRule[]> {
  const { rows } = await query<RewardRule>(
    `SELECT id, gym_id, type, threshold, discount_percent, description, is_active, created_at
     FROM reward_rules WHERE gym_id = $1 AND is_active = true ORDER BY created_at ASC`,
    [gymId],
  );
  return rows;
}

export async function createRule(gymId: string, data: CreateRewardRulePayload): Promise<RewardRule> {
  const { rows } = await query<RewardRule>(
    `INSERT INTO reward_rules (gym_id, type, threshold, discount_percent, description)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, gym_id, type, threshold, discount_percent, description, is_active, created_at`,
    [gymId, data.type, data.threshold, data.discount_percent, data.description],
  );
  return rows[0];
}

export async function updateRule(
  gymId: string,
  ruleId: string,
  patch: UpdateRewardRulePayload,
): Promise<RewardRule | null> {
  const setClauses: string[] = [];
  const values: unknown[] = [gymId, ruleId];
  let idx = 3;
  if (patch.is_active !== undefined) { setClauses.push(`is_active = $${idx++}`); values.push(patch.is_active); }
  if (patch.threshold !== undefined) { setClauses.push(`threshold = $${idx++}`); values.push(patch.threshold); }
  if (patch.discount_percent !== undefined) { setClauses.push(`discount_percent = $${idx++}`); values.push(patch.discount_percent); }
  if (patch.description !== undefined) { setClauses.push(`description = $${idx++}`); values.push(patch.description); }
  if (setClauses.length === 0) return null;

  const { rows } = await query<RewardRule>(
    `UPDATE reward_rules SET ${setClauses.join(', ')}
     WHERE gym_id = $1 AND id = $2
     RETURNING id, gym_id, type, threshold, discount_percent, description, is_active, created_at`,
    values,
  );
  return rows[0] ?? null;
}

export async function deleteRule(gymId: string, ruleId: string): Promise<boolean> {
  const { rowCount } = await query(
    'DELETE FROM reward_rules WHERE gym_id = $1 AND id = $2',
    [gymId, ruleId],
  );
  return (rowCount ?? 0) > 0;
}

// ── Evaluation helpers ─────────────────────────────────────────────────────────

export async function getEarnedCount(userId: string, ruleId: string): Promise<number> {
  const { rows } = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM member_rewards WHERE user_id = $1 AND rule_id = $2`,
    [userId, ruleId],
  );
  return parseInt(rows[0].count, 10);
}

export async function getTotalVisits(gymId: string, userId: string): Promise<number> {
  const { rows } = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM check_ins WHERE gym_id = $1 AND user_id = $2`,
    [gymId, userId],
  );
  return parseInt(rows[0].count, 10);
}

export async function getQualifyingWeeks(gymId: string, userId: string): Promise<string[]> {
  const { rows } = await query<{ week_start: string }>(
    `SELECT date_trunc('week', checked_in_at AT TIME ZONE 'UTC')::date::text AS week_start
     FROM check_ins
     WHERE gym_id = $1 AND user_id = $2
     GROUP BY week_start
     HAVING COUNT(*) >= 2
     ORDER BY week_start DESC`,
    [gymId, userId],
  );
  return rows.map((r) => r.week_start);
}

export async function getPreviousCheckIn(gymId: string, userId: string): Promise<CheckIn | null> {
  const { rows } = await query<CheckIn>(
    `SELECT id, user_id, gym_id, checked_in_at
     FROM check_ins
     WHERE gym_id = $1 AND user_id = $2
     ORDER BY checked_in_at DESC
     LIMIT 1 OFFSET 1`,
    [gymId, userId],
  );
  return rows[0] ?? null;
}

export async function getLastRewardEarnedAt(userId: string, ruleId: string): Promise<Date | null> {
  const { rows } = await query<{ earned_at: Date }>(
    `SELECT earned_at FROM member_rewards WHERE user_id = $1 AND rule_id = $2 ORDER BY earned_at DESC LIMIT 1`,
    [userId, ruleId],
  );
  return rows[0]?.earned_at ?? null;
}

// ── Grant ──────────────────────────────────────────────────────────────────────

export async function grantReward(gymId: string, userId: string, ruleId: string): Promise<MemberReward> {
  const { rows } = await query<MemberReward>(
    `INSERT INTO member_rewards (user_id, gym_id, rule_id)
     VALUES ($1, $2, $3)
     RETURNING id, user_id, gym_id, rule_id, earned_at, redeemed_at, redeemed_by`,
    [userId, gymId, ruleId],
  );
  return rows[0];
}

// ── Member view ────────────────────────────────────────────────────────────────

export async function getMyRewards(gymId: string, userId: string): Promise<MemberRewardWithMember[]> {
  const { rows } = await query<MemberRewardWithMember>(
    `SELECT mr.id, mr.user_id, mr.gym_id, mr.rule_id, mr.earned_at, mr.redeemed_at, mr.redeemed_by,
            rr.type AS rule_type, rr.description AS rule_description, rr.discount_percent,
            u.full_name AS member_name, u.email AS member_email
     FROM member_rewards mr
     JOIN reward_rules rr ON rr.id = mr.rule_id
     JOIN users u ON u.id = mr.user_id
     WHERE mr.gym_id = $1 AND mr.user_id = $2 AND mr.redeemed_at IS NULL
     ORDER BY mr.earned_at DESC`,
    [gymId, userId],
  );
  return rows;
}

// ── Admin view ─────────────────────────────────────────────────────────────────

export async function getAllRewards(gymId: string): Promise<MemberRewardWithMember[]> {
  const { rows } = await query<MemberRewardWithMember>(
    `SELECT mr.id, mr.user_id, mr.gym_id, mr.rule_id, mr.earned_at, mr.redeemed_at, mr.redeemed_by,
            rr.type AS rule_type, rr.description AS rule_description, rr.discount_percent,
            u.full_name AS member_name, u.email AS member_email
     FROM member_rewards mr
     JOIN reward_rules rr ON rr.id = mr.rule_id
     JOIN users u ON u.id = mr.user_id
     WHERE mr.gym_id = $1
     ORDER BY mr.earned_at DESC`,
    [gymId],
  );
  return rows;
}

export async function redeemReward(
  gymId: string,
  rewardId: string,
  adminUserId: string,
): Promise<MemberReward | null> {
  const { rows } = await query<MemberReward>(
    `UPDATE member_rewards
     SET redeemed_at = now(), redeemed_by = $3
     WHERE gym_id = $1 AND id = $2 AND redeemed_at IS NULL
     RETURNING id, user_id, gym_id, rule_id, earned_at, redeemed_at, redeemed_by`,
    [gymId, rewardId, adminUserId],
  );
  return rows[0] ?? null;
}
