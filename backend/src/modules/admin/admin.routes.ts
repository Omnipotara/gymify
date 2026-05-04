import { Router } from 'express';
import { requireAuth } from '../../middleware/require-auth';
import { requireSuperAdmin } from '../../middleware/require-super-admin';
import {
  handleGetStats,
  handleGetGyms,
  handleCreateGym,
  handleDeleteGym,
  handleGetUsers,
  handleSetGymRole,
  handleGetGymAdmins,
  handleAddGymAdmin,
  handleRemoveGymAdmin,
} from './admin.controller';

export const adminRouter = Router();

// All admin routes require authentication + super-admin role
adminRouter.use(requireAuth, requireSuperAdmin);

adminRouter.get('/stats', handleGetStats);
adminRouter.get('/gyms', handleGetGyms);
adminRouter.post('/gyms', handleCreateGym);
adminRouter.delete('/gyms/:gymId', handleDeleteGym);
adminRouter.get('/users', handleGetUsers);
adminRouter.patch('/gyms/:gymId/members/:userId/role', handleSetGymRole);
adminRouter.get('/gyms/:gymId/admins', handleGetGymAdmins);
adminRouter.post('/gyms/:gymId/admins', handleAddGymAdmin);
adminRouter.delete('/gyms/:gymId/admins/:userId', handleRemoveGymAdmin);
