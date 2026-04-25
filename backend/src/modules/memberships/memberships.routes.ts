import { Router } from 'express';
import { requireAuth } from '../../middleware/require-auth';
import { requireGymMembership } from '../../middleware/require-gym-membership';
import { handleGetMyMembership, handleCreateMembership } from './memberships.controller';

export const membershipsRouter = Router({ mergeParams: true });

// Member: get own membership status
membershipsRouter.get('/me/membership', requireAuth, requireGymMembership(), handleGetMyMembership);

// Admin: create membership for any member of this gym
membershipsRouter.post('/memberships', requireAuth, requireGymMembership('admin'), handleCreateMembership);
