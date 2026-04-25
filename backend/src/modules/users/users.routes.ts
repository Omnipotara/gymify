import { Router } from 'express';
import { requireAuth } from '../../middleware/require-auth';
import { handleGetMe, handleGetMyGyms } from './users.controller';

export const usersRouter = Router();

usersRouter.get('/', requireAuth, handleGetMe);
usersRouter.get('/gyms', requireAuth, handleGetMyGyms);
