import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { config } from '../../config';
import { ValidationError } from '../../lib/errors';
import * as service from './auth.service';

const COOKIE_NAME = 'token';
const COOKIE_OPTS = {
  httpOnly: true,
  secure: config.isProd,
  sameSite: 'strict' as const,
  maxAge: 60 * 60 * 1000, // 1 hour — matches JWT expiry
  path: '/',
};

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  full_name: z.string().optional(),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function handleRegister(req: Request, res: Response, next: NextFunction) {
  try {
    const result = registerSchema.safeParse(req.body);
    if (!result.success) throw new ValidationError('Validation failed', result.error.flatten().fieldErrors as Record<string, string[]>);

    const { token, user } = await service.register({
      email: result.data.email,
      password: result.data.password,
      fullName: result.data.full_name,
      phone: result.data.phone,
    });
    res.cookie(COOKIE_NAME, token, COOKIE_OPTS).status(201).json({ user });
  } catch (err) {
    next(err);
  }
}

export async function handleLogin(req: Request, res: Response, next: NextFunction) {
  try {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) throw new ValidationError('Validation failed', result.error.flatten().fieldErrors as Record<string, string[]>);

    const { token, user } = await service.login({ email: result.data.email, password: result.data.password });
    res.cookie(COOKIE_NAME, token, COOKIE_OPTS).json({ user });
  } catch (err) {
    next(err);
  }
}

export function handleLogout(_req: Request, res: Response) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: config.isProd, sameSite: 'strict', path: '/' })
    .status(204)
    .send();
}
