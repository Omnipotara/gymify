import type { MembershipStatus } from '../memberships/types';
import type { WeeklyVisit } from '../memberships/types';

export interface MemberProfileResponse {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: 'member' | 'admin';
  joined_at: string;
  membership: {
    id: string | null;
    status: MembershipStatus;
    start_date: string | null;
    end_date: string | null;
  };
  stats: {
    total_visits: number;
    visits_last_30_days: number;
    visits_this_week: number;
    days_until_expiry: number | null;
    member_since: string;
    weekly_trend: WeeklyVisit[];
  };
}
