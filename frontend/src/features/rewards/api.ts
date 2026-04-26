import { api } from '../../lib/api-client';
import type { CreateRewardRulePayload, MyReward, RewardRule } from './types';

export const getMyRewards = (gymId: string) =>
  api.get<{ items: MyReward[] }>(`/api/gyms/${gymId}/me/rewards`);

export const getRules = (gymId: string) =>
  api.get<{ items: RewardRule[] }>(`/api/gyms/${gymId}/reward-rules`);

export const createRule = (gymId: string, payload: CreateRewardRulePayload) =>
  api.post<RewardRule>(`/api/gyms/${gymId}/reward-rules`, payload);

export const updateRule = (gymId: string, ruleId: string, payload: Partial<CreateRewardRulePayload> & { is_active?: boolean }) =>
  api.patch<RewardRule>(`/api/gyms/${gymId}/reward-rules/${ruleId}`, payload);

export const deleteRule = (gymId: string, ruleId: string) =>
  api.delete<void>(`/api/gyms/${gymId}/reward-rules/${ruleId}`);

export const getAllRewards = (gymId: string) =>
  api.get<{ items: MyReward[] }>(`/api/gyms/${gymId}/rewards`);

export const redeemReward = (gymId: string, rewardId: string) =>
  api.post<MyReward>(`/api/gyms/${gymId}/rewards/${rewardId}/redeem`, {});
