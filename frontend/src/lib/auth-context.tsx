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
  login: (user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Validate session by hitting /api/me — the HttpOnly cookie is sent automatically.
    api
      .get<AuthUser>('/api/me')
      .then(setUser)
      .catch((err) => {
        // 401 just means no valid session — not an error worth logging
        if (!(err instanceof ApiError && err.status === 401)) {
          console.error('Failed to restore session', err);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // api-client dispatches this when any request gets a 401 mid-session
    const handleUnauthorized = () => setUser(null);
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const login = useCallback((u: AuthUser) => {
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    api.post('/api/auth/logout', {}).catch(() => {});
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
