import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError } from '../../lib/errors';
import * as service from './admin.service';

export async function handleGetStats(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.getPlatformStats());
  } catch (err) { next(err); }
}

export async function handleGetGyms(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ items: await service.getAllGyms() });
  } catch (err) { next(err); }
}

export async function handleCreateGym(req: Request, res: Response, next: NextFunction) {
  try {
    const result = z.object({ name: z.string().min(1).max(100) }).safeParse(req.body);
    if (!result.success) throw new ValidationError('name is required and must be under 100 characters');
    res.status(201).json(await service.createGym(result.data.name));
  } catch (err) { next(err); }
}

export async function handleDeleteGym(req: Request, res: Response, next: NextFunction) {
  try {
    await service.deleteGym(req.params.gymId);
    res.status(204).end();
  } catch (err) { next(err); }
}

export async function handleGetUsers(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ items: await service.getAllUsers() });
  } catch (err) { next(err); }
}

export async function handleSetGymRole(req: Request, res: Response, next: NextFunction) {
  try {
    const result = z.object({ role: z.enum(['admin', 'member']) }).safeParse(req.body);
    if (!result.success) throw new ValidationError('role must be "admin" or "member"');
    await service.setGymMemberRole(req.params.gymId, req.params.userId, result.data.role);
    res.status(204).end();
  } catch (err) { next(err); }
}
