import type { RewardSummary } from '../rewards/types';

export interface CheckIn {
  id: string;
  user_id: string;
  gym_id: string;
  checked_in_at: string;
  new_rewards?: RewardSummary[];
}

export interface CheckInHistoryResponse {
  items: CheckIn[];
  next_cursor: string | null;
}

export interface CheckInLogEntry {
  id: string;
  user_id: string;
  checked_in_at: string;
  member_name: string | null;
  member_email: string;
}
