import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../../middleware/require-auth';
import { handleJoin } from './gyms.controller';

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
