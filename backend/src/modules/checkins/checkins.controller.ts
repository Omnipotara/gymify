import type { Request, Response, NextFunction } from 'express';
import * as service from './checkins.service';

export async function handleCheckIn(req: Request, res: Response, next: NextFunction) {
  try {
    const checkIn = await service.checkIn(req.params.gymId, req.user!.id, req.body, req.gymRole!);
    res.status(201).json(checkIn);
  } catch (err) {
    next(err);
  }
}

export async function handleGetGymLog(req: Request, res: Response, next: NextFunction) {
  try {
    const items = await service.getGymLog(req.params.gymId);
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function handleGetHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const before = typeof req.query.before === 'string' ? req.query.before : undefined;
    const data = await service.getHistory(req.params.gymId, req.user!.id, limit, before);
    res.json(data);
  } catch (err) {
    next(err);
  }
}
