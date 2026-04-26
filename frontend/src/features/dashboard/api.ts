import { api } from '../../lib/api-client';
import type { DashboardResponse } from './types';

export const getDashboard = (gymId: string) =>
  api.get<DashboardResponse>(`/api/gyms/${gymId}/dashboard`);
