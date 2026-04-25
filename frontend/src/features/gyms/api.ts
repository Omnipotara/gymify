import { api } from '../../lib/api-client';
import type { MeGymsResponse, JoinResponse } from './types';

export const getMyGyms = () => api.get<MeGymsResponse>('/api/me/gyms');

export const joinGym = (payload: unknown) => api.post<JoinResponse>('/api/gyms/join', payload);
