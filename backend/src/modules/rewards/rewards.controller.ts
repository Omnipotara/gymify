import type { NextFunction, Request, Response } from 'express';
import * as service from './rewards.service';

export async function handleGetRules(req: Request, res: Response, next: NextFunction) {
  try {
    const rules = await service.getRules(req.params.gymId);
    res.json({ items: rules });
  } catch (err) { next(err); }
}

export async function handleCreateRule(req: Request, res: Response, next: NextFunction) {
  try {
    const rule = await service.createRule(req.params.gymId, req.body);
    res.status(201).json(rule);
  } catch (err) { next(err); }
}

export async function handleUpdateRule(req: Request, res: Response, next: NextFunction) {
  try {
    const rule = await service.updateRule(req.params.gymId, req.params.ruleId, req.body);
    res.json(rule);
  } catch (err) { next(err); }
}

export async function handleDeleteRule(req: Request, res: Response, next: NextFunction) {
  try {
    await service.deleteRule(req.params.gymId, req.params.ruleId);
    res.status(204).end();
  } catch (err) { next(err); }
}

export async function handleGetMyRewards(req: Request, res: Response, next: NextFunction) {
  try {
    const rewards = await service.getMyRewards(req.params.gymId, req.user!.id);
    res.json({ items: rewards });
  } catch (err) { next(err); }
}

export async function handleGetAllRewards(req: Request, res: Response, next: NextFunction) {
  try {
    const rewards = await service.getAllRewards(req.params.gymId);
    res.json({ items: rewards });
  } catch (err) { next(err); }
}

export async function handleRedeemReward(req: Request, res: Response, next: NextFunction) {
  try {
    const reward = await service.redeemReward(req.params.gymId, req.params.rewardId, req.user!.id);
    res.json(reward);
  } catch (err) { next(err); }
}
