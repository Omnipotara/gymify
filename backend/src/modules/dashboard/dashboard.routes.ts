import { Router } from 'express';
import { requireAuth } from '../../middleware/require-auth';
import { requireGymMembership } from '../../middleware/require-gym-membership';
import { handleGetDashboard } from './dashboard.controller';

export const dashboardRouter = Router({ mergeParams: true });

dashboardRouter.get('/dashboard', requireAuth, requireGymMembership('admin'), handleGetDashboard);
