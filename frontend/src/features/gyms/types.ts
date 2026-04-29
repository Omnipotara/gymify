export interface QrPayloadResponse {
  payload: Record<string, unknown>;
}

export interface RotatingQrPayloadResponse {
  payload: Record<string, unknown>;
  expires_at: number;
}

export interface GymSummary {
  id: string;
  name: string;
  slug: string | null;
  role: 'member' | 'admin';
}

export interface MeGymsResponse {
  user: { id: string; email: string; full_name: string | null; is_super_admin: boolean };
  gyms: GymSummary[];
}

export interface JoinResponse {
  gym: GymSummary;
}
