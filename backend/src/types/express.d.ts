export {};

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string; is_super_admin: boolean };
      gymRole?: 'member' | 'admin';
    }
  }
}
