import type { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../lib/errors';

export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user?.is_super_admin) {
    next(new ForbiddenError());
    return;
  }
  next();
}
