import type { Request, Response, NextFunction } from 'express';
import { query } from '../db/client';
import { NotFoundError, ForbiddenError } from '../lib/errors';

/**
 * Verifies the authenticated user is a member (or admin) of req.params.gymId.
 * Returns 404 (not 403) when the user isn't a member — don't leak gym existence.
 * Pass role='admin' to additionally require the admin role.
 */
export function requireGymMembership(role?: 'admin') {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const { gymId } = req.params;
      const userId = req.user!.id;

      const { rows } = await query<{ role: string }>(
        'SELECT role FROM user_gyms WHERE user_id = $1 AND gym_id = $2',
        [userId, gymId],
      );

      if (rows.length === 0) {
        next(new NotFoundError());
        return;
      }

      req.gymRole = rows[0].role as 'member' | 'admin';

      if (role === 'admin' && req.gymRole !== 'admin') {
        next(new ForbiddenError());
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
