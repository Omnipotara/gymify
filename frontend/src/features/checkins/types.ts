export interface CheckIn {
  id: string;
  user_id: string;
  gym_id: string;
  checked_in_at: string;
}

export interface CheckInHistoryResponse {
  items: CheckIn[];
  next_cursor: string | null;
}
