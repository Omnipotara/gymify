import { api } from '../../lib/api-client';
import type { CreateRewardRulePayload, MyReward, RewardRule } from './types';

export const getMyRewards = (gymId: string) =>
  api.get<{ items: MyReward[] }>(`/api/gyms/${gymId}/me/rewards`);

export const getRules = (gymId: string) =>
  api.get<{ items: RewardRule[] }>(`/api/gyms/${gymId}/reward-rules`);

export const createRule = (gymId: string, payload: CreateRewardRulePayload) =>
  api.post<RewardRule>(`/api/gyms/${gymId}/reward-rules`, payload);

export const toggleRule = (gymId: string, ruleId: string, is_active: boolean) =>
  api.patch<RewardRule>(`/api/gyms/${gymId}/reward-rules/${ruleId}`, { is_active });

export const getAllRewards = (gymId: string) =>
  api.get<{ items: MyReward[] }>(`/api/gyms/${gymId}/rewards`);

export const redeemReward = (gymId: string, rewardId: string) =>
  api.post<MyReward>(`/api/gyms/${gymId}/rewards/${rewardId}/redeem`, {});
