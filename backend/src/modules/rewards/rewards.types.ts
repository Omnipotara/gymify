export type RewardType = 'streak' | 'milestone' | 'comeback';

export interface RewardRule {
  id: string;
  gym_id: string;
  type: RewardType;
  threshold: number;
  discount_percent: number;
  description: string;
  is_active: boolean;
  created_at: Date;
}

export interface MemberReward {
  id: string;
  user_id: string;
  gym_id: string;
  rule_id: string;
  earned_at: Date;
  redeemed_at: Date | null;
  redeemed_by: string | null;
}

export interface MemberRewardWithMember extends MemberReward {
  rule_type: RewardType;
  rule_description: string;
  discount_percent: number;
  member_name: string | null;
  member_email: string;
}

export interface CreateRewardRulePayload {
  type: RewardType;
  threshold: number;
  discount_percent: number;
  description: string;
}

export interface UpdateRewardRulePayload {
  is_active?: boolean;
  threshold?: number;
  discount_percent?: number;
  description?: string;
}

export interface RewardSummary {
  description: string;
  discount_percent: number;
  type: RewardType;
}
