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

export interface WeeklyVisit {
  week_offset: number; // 0 = this week, 1 = last week, etc.
  visits: number;
}

export interface MemberStatsResponse {
  total_visits: number;
  visits_last_30_days: number;
  visits_this_week: number;
  days_until_expiry: number | null;
  member_since: string;
  weekly_trend: WeeklyVisit[];
}

export interface MemberProfileResponse {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: 'member' | 'admin';
  joined_at: string;
  membership: MyMembershipResponse;
  stats: MemberStatsResponse;
}
