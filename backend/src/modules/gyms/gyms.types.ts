export interface Gym {
  id: string;
  name: string;
  slug: string | null;
  join_qr_secret: string;
  checkin_qr_secret: string;
  created_at: Date;
}

export interface JoinResponse {
  gym: {
    id: string;
    name: string;
    slug: string | null;
    role: 'member';
  };
}

import type { MembershipStatus } from '../../lib/membership-status';

export interface MemberWithStatus {
  id: string;
  email: string;
  full_name: string | null;
  role: 'member' | 'admin';
  joined_at: string;
  membership: {
    id: string | null;
    status: MembershipStatus;
    start_date: string | null;
    end_date: string | null;
  };
}
