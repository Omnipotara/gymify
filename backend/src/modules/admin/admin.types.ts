export interface PlatformStats {
  gym_count: number;
  user_count: number;
  checkins_today: number;
  active_members: number;
  checkins_total: number;
  new_users_this_week: number;
}

export interface AdminGym {
  id: string;
  name: string;
  slug: string;
  member_count: number;
  created_at: string;
}

export interface AdminUserGym {
  gym_id: string;
  gym_name: string;
  role: 'member' | 'admin';
}

export interface GymAdmin {
  id: string;
  email: string;
  full_name: string | null;
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  is_super_admin: boolean;
  created_at: string;
  gyms: AdminUserGym[];
}
