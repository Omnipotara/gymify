import crypto from 'crypto';
import { NotFoundError, ValidationError } from '../../lib/errors';
import { encryptSecret } from '../../lib/crypto';
import { sendGymAdminNotificationEmail } from '../../lib/email';
import * as repo from './admin.repository';
import type { AdminGym, AdminUser, GymAdmin, PlatformStats } from './admin.types';

export async function getPlatformStats(): Promise<PlatformStats> {
  return repo.getPlatformStats();
}

export async function getAllGyms(): Promise<AdminGym[]> {
  return repo.getAllGyms();
}

export async function createGym(name: string): Promise<{ id: string; name: string; slug: string }> {
  const trimmed = name.trim();
  if (!trimmed) throw new ValidationError('Gym name is required');

  // Derive slug from name; append random hex suffix to ensure uniqueness
  const base = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  let slug = base;
  if (await repo.gymSlugExists(slug)) {
    slug = `${base}-${crypto.randomBytes(3).toString('hex')}`;
  }

  const joinQrSecret = encryptSecret(crypto.randomBytes(32).toString('hex'));
  const checkinQrSecret = encryptSecret(crypto.randomBytes(32).toString('hex'));

  return repo.createGym(trimmed, slug, joinQrSecret, checkinQrSecret);
}

export async function deleteGym(gymId: string): Promise<void> {
  const deleted = await repo.deleteGym(gymId);
  if (!deleted) throw new NotFoundError('Gym not found');
}

export async function getAllUsers(): Promise<AdminUser[]> {
  return repo.getAllUsers();
}

export async function setGymMemberRole(
  gymId: string,
  userId: string,
  role: 'admin' | 'member',
): Promise<void> {
  await repo.setGymMemberRole(gymId, userId, role);
}

export async function getGymAdmins(gymId: string): Promise<GymAdmin[]> {
  return repo.getGymAdmins(gymId);
}

export async function addGymAdmin(gymId: string, email: string): Promise<void> {
  const [user, gym] = await Promise.all([
    repo.findUserByEmail(email),
    repo.findGymById(gymId),
  ]);
  if (!user) throw new NotFoundError('No user with that email exists');
  if (!gym) throw new NotFoundError('Gym not found');

  await repo.addGymAdmin(gymId, user.id);
  await sendGymAdminNotificationEmail(user.email, gym.name);
}

export async function removeGymAdmin(gymId: string, userId: string): Promise<void> {
  const removed = await repo.removeGymAdmin(gymId, userId);
  if (!removed) throw new NotFoundError('This user is not an admin of this gym');
}
