import { Router } from 'express';
import { requireAuth } from '../../middleware/require-auth';
import { requireGymMembership } from '../../middleware/require-gym-membership';
import {
  handleCreateRule,
  handleDeleteRule,
  handleGetAllRewards,
  handleGetMyRewards,
  handleGetRules,
  handleRedeemReward,
  handleUpdateRule,
} from './rewards.controller';

export const rewardsRouter = Router({ mergeParams: true });

// Member: own unredeemed rewards
rewardsRouter.get('/me/rewards', requireAuth, requireGymMembership(), handleGetMyRewards);

// Admin: rule management
rewardsRouter.get('/reward-rules', requireAuth, requireGymMembership('admin'), handleGetRules);
rewardsRouter.post('/reward-rules', requireAuth, requireGymMembership('admin'), handleCreateRule);
rewardsRouter.patch('/reward-rules/:ruleId', requireAuth, requireGymMembership('admin'), handleUpdateRule);
rewardsRouter.delete('/reward-rules/:ruleId', requireAuth, requireGymMembership('admin'), handleDeleteRule);

// Admin: member rewards
rewardsRouter.get('/rewards', requireAuth, requireGymMembership('admin'), handleGetAllRewards);
rewardsRouter.post('/rewards/:rewardId/redeem', requireAuth, requireGymMembership('admin'), handleRedeemReward);
