import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { logger } from './lib/logger';
import { errorHandler } from './middleware/error-handler';

const app = express();

// Security headers
app.use(helmet());

// CORS
app.use(cors({ origin: config.allowedOrigin, credentials: true }));

// Request logging (skip in test environment)
if (!config.isTest) {
  app.use(pinoHttp({ logger }));
}

// Body parsing
app.use(express.json());

// Global rate limit — specific endpoints will apply stricter limits
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Feature routers are mounted here as each module is built:
// app.use('/api/auth', authRouter);
// app.use('/api/me', meRouter);
// app.use('/api/gyms', gymsRouter);
// app.use('/api/platform', platformRouter);

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
