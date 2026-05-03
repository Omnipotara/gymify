import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../../config';
import { handleRegister, handleLogin, handleLogout } from './auth.controller';

const registerLimiter = rateLimit({ windowMs: 60_000, max: 3, standardHeaders: true, legacyHeaders: false, skip: () => config.isTest });
const loginLimiter = rateLimit({ windowMs: 60_000, max: 5, standardHeaders: true, legacyHeaders: false, skip: () => config.isTest });

export const authRouter = Router();

authRouter.post('/register', registerLimiter, handleRegister);
authRouter.post('/login', loginLimiter, handleLogin);
authRouter.post('/logout', handleLogout);
