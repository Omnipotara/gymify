import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../../config';
import { handleRegister, handleLogin, handleLogout, handleForgotPassword, handleResetPassword } from './auth.controller';

const registerLimiter = rateLimit({ windowMs: 60_000, max: 3, standardHeaders: true, legacyHeaders: false, skip: () => config.isTest });
const loginLimiter = rateLimit({ windowMs: 60_000, max: 5, standardHeaders: true, legacyHeaders: false, skip: () => config.isTest });
const forgotLimiter = rateLimit({ windowMs: 15 * 60_000, max: 5, standardHeaders: true, legacyHeaders: false, skip: () => config.isTest });
const resetLimiter = rateLimit({ windowMs: 15 * 60_000, max: 10, standardHeaders: true, legacyHeaders: false, skip: () => config.isTest });

export const authRouter = Router();

authRouter.post('/register', registerLimiter, handleRegister);
authRouter.post('/login', loginLimiter, handleLogin);
authRouter.post('/logout', handleLogout);
authRouter.post('/forgot-password', forgotLimiter, handleForgotPassword);
authRouter.post('/reset-password', resetLimiter, handleResetPassword);
