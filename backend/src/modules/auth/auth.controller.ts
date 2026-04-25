import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError } from '../../lib/errors';
import * as service from './auth.service';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  full_name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function handleRegister(req: Request, res: Response, next: NextFunction) {
  try {
    const result = registerSchema.safeParse(req.body);
    if (!result.success) throw new ValidationError('Validation failed', result.error.flatten().fieldErrors as Record<string, string[]>);

    const data = await service.register({
      email: result.data.email,
      password: result.data.password,
      fullName: result.data.full_name,
    });
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
}

export async function handleLogin(req: Request, res: Response, next: NextFunction) {
  try {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) throw new ValidationError('Validation failed', result.error.flatten().fieldErrors as Record<string, string[]>);

    const data = await service.login({ email: result.data.email, password: result.data.password });
    res.json(data);
  } catch (err) {
    next(err);
  }
}
