import type { RewardSummary } from '../rewards/rewards.types';

export interface CheckIn {
  id: string;
  user_id: string;
  gym_id: string;
  checked_in_at: Date;
}

export interface CheckInResult extends CheckIn {
  new_rewards: RewardSummary[];
}
