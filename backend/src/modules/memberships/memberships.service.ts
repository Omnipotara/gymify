import { NotFoundError } from '../../lib/errors';
import { computeMembershipStatus } from '../../lib/membership-status';
import { findUserGym } from '../gyms/gyms.repository';
import * as repo from './memberships.repository';
import type { MembershipWithStatus, MyMembershipResponse } from './memberships.types';

export async function getMyMembership(
  gymId: string,
  userId: string,
  userRole: 'member' | 'admin',
): Promise<MyMembershipResponse> {
  // Admins have permanent access — always show active with no expiry
  if (userRole === 'admin') {
    return { status: 'active', id: null, start_date: null, end_date: null };
  }
  const membership = await repo.findLatestByUserAndGym(gymId, userId);
  return {
    status: computeMembershipStatus(membership),
    id: membership?.id ?? null,
    start_date: membership?.start_date ?? null,
    end_date: membership?.end_date ?? null,
  };
}

export async function patchMembershipEndDate(
  gymId: string,
  membershipId: string,
  endDate: string,
): Promise<MembershipWithStatus> {
  const updated = await repo.updateEndDate(gymId, membershipId, endDate);
  if (!updated) throw new NotFoundError('Membership not found');
  return { ...updated, status: computeMembershipStatus(updated) };
}

export async function createMembership(
  gymId: string,
  adminId: string,
  data: { userId: string; startDate: string; endDate: string },
): Promise<MembershipWithStatus> {
  const userGym = await findUserGym(data.userId, gymId);
  if (!userGym) throw new NotFoundError('User is not a member of this gym');

  const membership = await repo.create({
    gymId,
    userId: data.userId,
    startDate: data.startDate,
    endDate: data.endDate,
    createdBy: adminId,
  });

  return { ...membership, status: computeMembershipStatus(membership) };
}
