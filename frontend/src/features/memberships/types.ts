export type MembershipStatus = 'active' | 'expiring_soon' | 'expired' | 'none';

export interface MyMembershipResponse {
  status: MembershipStatus;
  id: string | null;
  start_date: string | null;
  end_date: string | null;
}

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

export interface MembersResponse {
  items: MemberWithStatus[];
}

export interface CreateMembershipPayload {
  user_id: string;
  start_date: string;
  end_date: string;
}
