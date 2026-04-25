import type { MembershipStatus } from '../../lib/membership-status';

export interface Membership {
  id: string;
  user_id: string;
  gym_id: string;
  start_date: string;
  end_date: string;
  created_by: string | null;
  created_at: string;
}

export interface MembershipWithStatus extends Membership {
  status: MembershipStatus;
}

export interface MyMembershipResponse {
  status: MembershipStatus;
  id: string | null;
  start_date: string | null;
  end_date: string | null;
}
