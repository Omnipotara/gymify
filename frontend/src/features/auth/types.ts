export interface AuthUser {
  id: string;
  email: string;
  full_name: string | null;
  phone?: string | null;
  is_super_admin: boolean;
}

export interface AuthResponse {
  user: AuthUser;
}
