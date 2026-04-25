import { api } from '../../lib/api-client';
import type { AuthResponse } from './types';

export const register = (data: { email: string; password: string; full_name?: string }) =>
  api.post<AuthResponse>('/api/auth/register', data);

export const login = (data: { email: string; password: string }) =>
  api.post<AuthResponse>('/api/auth/login', data);
