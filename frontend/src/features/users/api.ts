import { api } from '../../lib/api-client';
import type { MemberProfileResponse } from './types';

export interface MeResponse {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  is_super_admin: boolean;
}

export const getMe = () => api.get<MeResponse>('/api/me');

export const updateMe = (data: { full_name?: string | null; phone?: string | null }) =>
  api.patch<MeResponse>('/api/me', data);

export const getMemberProfile = (gymId: string, userId: string) =>
  api.get<MemberProfileResponse>(`/api/gyms/${gymId}/members/${userId}`);
