import type { Request, Response, NextFunction } from 'express';
import * as service from './dashboard.service';

export async function handleGetDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getDashboard(req.params.gymId);
    res.json(data);
  } catch (err) {
    next(err);
  }
}
