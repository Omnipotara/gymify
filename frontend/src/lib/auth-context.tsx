import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { api, ApiError } from './api-client';

interface AuthUser {
  id: string;
  email: string;
  full_name: string | null;
  is_super_admin: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get<AuthUser>('/api/me')
      .then(setUser)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback((token: string, u: AuthUser) => {
    localStorage.setItem('token', token);
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
