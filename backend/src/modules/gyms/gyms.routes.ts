import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../../middleware/require-auth';
import { requireGymMembership } from '../../middleware/require-gym-membership';
import { handleJoin, handleGetMembers } from './gyms.controller';

const qrLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  keyGenerator: (req) => req.user?.id ?? req.ip ?? 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
});

export const gymsRouter = Router();

// POST /api/gyms/join — must be before /:gymId routes
gymsRouter.post('/join', requireAuth, qrLimiter, handleJoin);

// GET /api/gyms/:gymId/members — admin only
gymsRouter.get('/:gymId/members', requireAuth, requireGymMembership('admin'), handleGetMembers);
