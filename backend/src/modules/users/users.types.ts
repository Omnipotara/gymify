export interface MeResponse {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  is_super_admin: boolean;
}

export interface GymSummary {
  id: string;
  name: string;
  slug: string | null;
  role: 'member' | 'admin';
}

export interface MeGymsResponse {
  user: MeResponse;
  gyms: GymSummary[];
}
