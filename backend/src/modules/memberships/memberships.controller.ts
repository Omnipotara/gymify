import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError } from '../../lib/errors';
import * as service from './memberships.service';

const createSchema = z.object({
  user_id: z.string().uuid(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
}).refine((d) => d.end_date >= d.start_date, {
  message: 'end_date must be on or after start_date',
  path: ['end_date'],
});

export async function handleGetMyMembership(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getMyMembership(req.params.gymId, req.user!.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function handleCreateMembership(req: Request, res: Response, next: NextFunction) {
  try {
    const result = createSchema.safeParse(req.body);
    if (!result.success)
      throw new ValidationError('Validation failed', result.error.flatten().fieldErrors as Record<string, string[]>);

    const data = await service.createMembership(req.params.gymId, req.user!.id, {
      userId: result.data.user_id,
      startDate: result.data.start_date,
      endDate: result.data.end_date,
    });
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
}
