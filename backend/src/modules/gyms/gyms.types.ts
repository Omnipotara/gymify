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
