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

app.use(helmet());
app.use(cors({ origin: config.allowedOrigin, credentials: true }));
app.use(cookieParser());

if (!config.isTest) {
  app.use(pinoHttp({ logger }));
}

app.set('trust proxy', 1);
app.use(express.json({ limit: '16kb' }));

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => config.isTest,
  }),
);

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

app.use((_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

app.use(errorHandler);

export default app;
