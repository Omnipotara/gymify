import { api } from '../../lib/api-client';
import type { MyMembershipResponse, MembersResponse, CreateMembershipPayload, MemberWithStatus, MemberStatsResponse } from './types';

export const getMyMembership = (gymId: string) =>
  api.get<MyMembershipResponse>(`/api/gyms/${gymId}/me/membership`);

export const getMemberStats = (gymId: string) =>
  api.get<MemberStatsResponse>(`/api/gyms/${gymId}/me/stats`);

export const getMembers = (gymId: string) =>
  api.get<MembersResponse>(`/api/gyms/${gymId}/members`);

export const createMembership = (gymId: string, payload: CreateMembershipPayload) =>
  api.post<MemberWithStatus>(`/api/gyms/${gymId}/memberships`, payload);

export const patchMembership = (
  gymId: string,
  membershipId: string,
  data: { start_date: string; end_date: string },
) => api.patch<MemberWithStatus>(`/api/gyms/${gymId}/memberships/${membershipId}`, data);

export const endMembershipsForUser = (gymId: string, userId: string) =>
  api.post<void>(`/api/gyms/${gymId}/memberships/end`, { user_id: userId });
