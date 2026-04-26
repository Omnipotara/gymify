export interface AuthUser {
  id: string;
  email: string;
  full_name: string | null;
  is_super_admin: boolean;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface DbUser extends AuthUser {
  password_hash: string;
  phone: string | null;
}
