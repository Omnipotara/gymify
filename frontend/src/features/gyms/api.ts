import { api } from '../../lib/api-client';
import type { MeGymsResponse, JoinResponse, QrPayloadResponse, RotatingQrPayloadResponse } from './types';

export const getMyGyms = () => api.get<MeGymsResponse>('/api/me/gyms');

export const joinGym = (payload: unknown) => api.post<JoinResponse>('/api/gyms/join', payload);

export const getJoinQrPayload = (gymId: string) =>
  api.get<QrPayloadResponse>(`/api/gyms/${gymId}/qr/join`);

export const getCheckinQrPayload = (gymId: string) =>
  api.get<RotatingQrPayloadResponse>(`/api/gyms/${gymId}/qr/checkin`);
