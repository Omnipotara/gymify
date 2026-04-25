import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { UnauthorizedError } from '../lib/errors';

interface JwtPayload {
  sub: string;
  email: string;
  is_super_admin: boolean;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(new UnauthorizedError());
    return;
  }

  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as JwtPayload;
    req.user = { id: payload.sub, email: payload.email, is_super_admin: payload.is_super_admin };
    next();
  } catch {
    next(new UnauthorizedError());
  }
}
