export type RewardType = 'streak' | 'milestone' | 'comeback';

export interface RewardRule {
  id: string;
  gym_id: string;
  type: RewardType;
  threshold: number;
  discount_percent: number;
  description: string;
  is_active: boolean;
  created_at: string;
}

export interface MyReward {
  id: string;
  user_id: string;
  gym_id: string;
  rule_id: string;
  rule_type: RewardType;
  rule_description: string;
  discount_percent: number;
  earned_at: string;
  redeemed_at: string | null;
  member_name: string | null;
  member_email: string;
}

export interface RewardSummary {
  description: string;
  discount_percent: number;
  type: RewardType;
}

export interface CreateRewardRulePayload {
  type: RewardType;
  threshold: number;
  discount_percent: number;
  description: string;
}
