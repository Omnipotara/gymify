import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { UnauthorizedError } from '../lib/errors';
import { logger } from '../lib/logger';

interface JwtPayload {
  sub: string;
  email: string;
  is_super_admin: boolean;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.token as string | undefined;
  if (!token) {
    next(new UnauthorizedError());
    return;
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret, {
      algorithms: ['HS256'],
    }) as JwtPayload;
    req.user = { id: payload.sub, email: payload.email, is_super_admin: payload.is_super_admin };
    next();
  } catch {
    logger.warn({ security: true, event: 'jwt_invalid', ip: req.ip }, 'JWT verification failed');
    next(new UnauthorizedError());
  }
}
