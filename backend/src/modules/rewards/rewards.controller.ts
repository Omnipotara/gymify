import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { ValidationError } from '../../lib/errors';
import * as service from './rewards.service';

const ruleTypeSchema = z.enum(['streak', 'milestone', 'comeback']);

const createRuleSchema = z.object({
  type: ruleTypeSchema,
  threshold: z.number().int().min(0),
  discount_percent: z.number().int().min(1).max(100),
  description: z.string().min(1).max(200).trim(),
});

const updateRuleSchema = z.object({
  type: ruleTypeSchema.optional(),
  threshold: z.number().int().min(0).optional(),
  discount_percent: z.number().int().min(1).max(100).optional(),
  description: z.string().min(1).max(200).trim().optional(),
  is_active: z.boolean().optional(),
});

export async function handleGetRules(req: Request, res: Response, next: NextFunction) {
  try {
    const rules = await service.getRules(req.params.gymId);
    res.json({ items: rules });
  } catch (err) { next(err); }
}

export async function handleCreateRule(req: Request, res: Response, next: NextFunction) {
  try {
    const result = createRuleSchema.safeParse(req.body);
    if (!result.success)
      throw new ValidationError('Validation failed', result.error.flatten().fieldErrors as Record<string, string[]>);
    const rule = await service.createRule(req.params.gymId, result.data);
    res.status(201).json(rule);
  } catch (err) { next(err); }
}

export async function handleUpdateRule(req: Request, res: Response, next: NextFunction) {
  try {
    const result = updateRuleSchema.safeParse(req.body);
    if (!result.success)
      throw new ValidationError('Validation failed', result.error.flatten().fieldErrors as Record<string, string[]>);
    const rule = await service.updateRule(req.params.gymId, req.params.ruleId, result.data);
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
