import type { Request, Response, NextFunction } from 'express';
import * as service from './users.service';

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
