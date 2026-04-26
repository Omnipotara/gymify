import { NotFoundError } from '../../lib/errors';
import * as repo from './users.repository';
import type { MeResponse, MeGymsResponse } from './users.types';

export async function getMe(userId: string): Promise<MeResponse> {
  const user = await repo.findById(userId);
  if (!user) throw new NotFoundError('User not found');
  return user;
}

export async function updateMe(
  userId: string,
  patch: { full_name?: string | null; phone?: string | null },
): Promise<MeResponse> {
  const user = await repo.updateProfile(userId, patch);
  if (!user) throw new NotFoundError('User not found');
  return user;
}

export async function getMyGyms(userId: string): Promise<MeGymsResponse> {
  const [user, gyms] = await Promise.all([repo.findById(userId), repo.findGymsByUserId(userId)]);
  if (!user) throw new NotFoundError('User not found');
  return { user, gyms };
}
