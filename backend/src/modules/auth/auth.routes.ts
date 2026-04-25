import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { handleRegister, handleLogin } from './auth.controller';

const registerLimiter = rateLimit({ windowMs: 60_000, max: 3, standardHeaders: true, legacyHeaders: false });
const loginLimiter = rateLimit({ windowMs: 60_000, max: 5, standardHeaders: true, legacyHeaders: false });

export const authRouter = Router();

authRouter.post('/register', registerLimiter, handleRegister);
authRouter.post('/login', loginLimiter, handleLogin);
