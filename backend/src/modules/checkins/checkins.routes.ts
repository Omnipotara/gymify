import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../../config';
import { requireAuth } from '../../middleware/require-auth';
import { requireGymMembership } from '../../middleware/require-gym-membership';
import { handleCheckIn, handleGetHistory, handleGetGymLog } from './checkins.controller';

const qrLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  keyGenerator: (req) => req.user?.id ?? req.ip ?? 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.isTest,
});

// Mounted at /api/gyms/:gymId — Express mergeParams required
export const checkinsRouter = Router({ mergeParams: true });

checkinsRouter.post(
  '/check-ins',
  requireAuth,
  requireGymMembership(),
  qrLimiter,
  handleCheckIn,
);

checkinsRouter.get(
  '/me/check-ins',
  requireAuth,
  requireGymMembership(),
  handleGetHistory,
);

// Admin: gym-wide live check-in log
checkinsRouter.get(
  '/check-ins',
  requireAuth,
  requireGymMembership('admin'),
  handleGetGymLog,
);
