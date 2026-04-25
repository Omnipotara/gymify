import type { Request, Response, NextFunction } from 'express';
import * as service from './gyms.service';

export async function handleJoin(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.joinGym(req.user!.id, req.body);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
}
