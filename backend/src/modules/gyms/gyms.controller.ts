import type { Request, Response, NextFunction } from 'express';
import * as service from './gyms.service';

export async function handleGetMembers(req: Request, res: Response, next: NextFunction) {
  try {
    const items = await service.getMembers(req.params.gymId);
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function handleJoin(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.joinGym(req.user!.id, req.body);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
}

export async function handleGetJoinQr(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getJoinQrPayload(req.params.gymId);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function handleGetCheckinQr(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getCheckinQrPayload(req.params.gymId);
    res.json(data);
  } catch (err) {
    next(err);
  }
}
