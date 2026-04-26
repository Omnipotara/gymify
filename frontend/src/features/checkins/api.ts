import { api } from '../../lib/api-client';
import type { CheckIn, CheckInHistoryResponse, CheckInLogEntry } from './types';

export const checkIn = (gymId: string, payload: unknown) =>
  api.post<CheckIn>(`/api/gyms/${gymId}/check-ins`, payload);

export const getCheckInHistory = (gymId: string) =>
  api.get<CheckInHistoryResponse>(`/api/gyms/${gymId}/me/check-ins`);

export const getGymCheckInLog = (gymId: string) =>
  api.get<{ items: CheckInLogEntry[] }>(`/api/gyms/${gymId}/check-ins`);
