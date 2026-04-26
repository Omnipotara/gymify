import { Router } from 'express';
import { requireAuth } from '../../middleware/require-auth';
import { handleGetMe, handleGetMyGyms, handleUpdateMe } from './users.controller';

export const usersRouter = Router();

usersRouter.get('/', requireAuth, handleGetMe);
usersRouter.patch('/', requireAuth, handleUpdateMe);
usersRouter.get('/gyms', requireAuth, handleGetMyGyms);
