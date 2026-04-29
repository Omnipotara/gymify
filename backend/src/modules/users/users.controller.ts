import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError } from '../../lib/errors';
import * as service from './users.service';

const updateMeSchema = z.object({
  full_name: z.string().max(100).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
});

export async function handleGetMe(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await service.getMe(req.user!.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

export async function handleGetMyGyms(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getMyGyms(req.user!.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function handleUpdateMe(req: Request, res: Response, next: NextFunction) {
  try {
    const result = updateMeSchema.safeParse(req.body);
    if (!result.success)
      throw new ValidationError('Validation failed', result.error.flatten().fieldErrors as Record<string, string[]>);
    const user = await service.updateMe(req.user!.id, result.data);
    res.json(user);
  } catch (err) {
    next(err);
  }
}
