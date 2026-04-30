import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { logger } from './lib/logger';
import { errorHandler } from './middleware/error-handler';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { gymsRouter } from './modules/gyms/gyms.routes';
import { checkinsRouter } from './modules/checkins/checkins.routes';
import { membershipsRouter } from './modules/memberships/memberships.routes';
import { dashboardRouter } from './modules/dashboard/dashboard.routes';
import { rewardsRouter } from './modules/rewards/rewards.routes';

const app = express();

// Security headers
app.use(helmet());

// CORS — credentials: true is required for cookies to be sent cross-origin in dev
app.use(cors({ origin: config.allowedOrigin, credentials: true }));

// Cookie parser — must come before routes so req.cookies is populated
app.use(cookieParser());

// Request logging (skip in test environment)
if (!config.isTest) {
  app.use(pinoHttp({ logger }));
}

// Trust one reverse-proxy hop (nginx / Cloudflare) so req.ip reflects the real client IP.
app.set('trust proxy', 1);

// Body parsing — 16 kb cap prevents large-payload DoS
app.use(express.json({ limit: '16kb' }));

// Global rate limit — specific endpoints apply stricter limits
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/me', usersRouter);
app.use('/api/gyms', gymsRouter);
app.use('/api/gyms/:gymId', checkinsRouter);
app.use('/api/gyms/:gymId', membershipsRouter);
app.use('/api/gyms/:gymId', dashboardRouter);
app.use('/api/gyms/:gymId', rewardsRouter);

// 404 — must come after all routes
app.use((_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

// Error handler — must be last
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(config.port, () => {
  logger.info(`Server listening on port ${config.port} [${config.nodeEnv}]`);
});

export default app;
