import { api } from '../../lib/api-client';
import type { MyMembershipResponse, MembersResponse, CreateMembershipPayload, MemberWithStatus } from './types';

export const getMyMembership = (gymId: string) =>
  api.get<MyMembershipResponse>(`/api/gyms/${gymId}/me/membership`);

export const getMembers = (gymId: string) =>
  api.get<MembersResponse>(`/api/gyms/${gymId}/members`);

export const createMembership = (gymId: string, payload: CreateMembershipPayload) =>
  api.post<MemberWithStatus>(`/api/gyms/${gymId}/memberships`, payload);

export const patchMembershipEndDate = (gymId: string, membershipId: string, endDate: string) =>
  api.patch<MemberWithStatus>(`/api/gyms/${gymId}/memberships/${membershipId}`, { end_date: endDate });

export const endMembershipsForUser = (gymId: string, userId: string) =>
  api.post<void>(`/api/gyms/${gymId}/memberships/end`, { user_id: userId });
