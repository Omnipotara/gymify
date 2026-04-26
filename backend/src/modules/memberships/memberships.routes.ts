import { Router } from 'express';
import { requireAuth } from '../../middleware/require-auth';
import { requireGymMembership } from '../../middleware/require-gym-membership';
import { handleGetMemberStats, handleGetMyMembership, handleCreateMembership, handlePatchMembership, handleEndMembershipForUser } from './memberships.controller';

export const membershipsRouter = Router({ mergeParams: true });

// Member: personal stats at this gym
membershipsRouter.get('/me/stats', requireAuth, requireGymMembership(), handleGetMemberStats);

// Member: get own membership status
membershipsRouter.get('/me/membership', requireAuth, requireGymMembership(), handleGetMyMembership);

// Admin: create membership for any member of this gym
membershipsRouter.post('/memberships', requireAuth, requireGymMembership('admin'), handleCreateMembership);

// Admin: end all active + future memberships for a user in one shot
membershipsRouter.post('/memberships/end', requireAuth, requireGymMembership('admin'), handleEndMembershipForUser);

// Admin: update end_date of an existing membership (used to end early or correct a mistake)
membershipsRouter.patch('/memberships/:membershipId', requireAuth, requireGymMembership('admin'), handlePatchMembership);
