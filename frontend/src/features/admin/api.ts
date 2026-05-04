import { api } from '../../lib/api-client';
import type { AdminGym, AdminUser, GymAdmin, PlatformStats } from './types';

export const getPlatformStats = () =>
  api.get<PlatformStats>('/api/admin/stats');

export const getAdminGyms = () =>
  api.get<{ items: AdminGym[] }>('/api/admin/gyms');

export const createGym = (name: string) =>
  api.post<{ id: string; name: string; slug: string }>('/api/admin/gyms', { name });

export const deleteGym = (gymId: string) =>
  api.delete<void>(`/api/admin/gyms/${gymId}`);

export const getAdminUsers = () =>
  api.get<{ items: AdminUser[] }>('/api/admin/users');

export const setGymRole = (gymId: string, userId: string, role: 'admin' | 'member') =>
  api.patch<void>(`/api/admin/gyms/${gymId}/members/${userId}/role`, { role });

export const getGymAdmins = (gymId: string) =>
  api.get<GymAdmin[]>(`/api/admin/gyms/${gymId}/admins`);

export const addGymAdmin = (gymId: string, email: string) =>
  api.post<void>(`/api/admin/gyms/${gymId}/admins`, { email });

export const removeGymAdmin = (gymId: string, userId: string) =>
  api.delete<void>(`/api/admin/gyms/${gymId}/admins/${userId}`);
