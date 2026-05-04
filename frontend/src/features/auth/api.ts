import { api } from '../../lib/api-client';
import type { AuthResponse } from './types';

export const register = (data: { email: string; password: string; full_name?: string; phone?: string }) =>
  api.post<AuthResponse>('/api/auth/register', data);

export const login = (data: { email: string; password: string }) =>
  api.post<AuthResponse>('/api/auth/login', data);

export const forgotPassword = (data: { email: string }) =>
  api.post<{ message: string }>('/api/auth/forgot-password', data);

export const resetPassword = (data: { email: string; code: string; new_password: string }) =>
  api.post<{ message: string }>('/api/auth/reset-password', data);
