import { NotFoundError } from '../../lib/errors';
import { computeMembershipStatus } from '../../lib/membership-status';
import { findUserGym } from '../gyms/gyms.repository';
import * as repo from './memberships.repository';
import type { MembershipWithStatus, MyMembershipResponse, MemberStatsResponse, MemberProfileResponse } from './memberships.types';

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

export async function getMemberStats(
  gymId: string,
  userId: string,
  userRole: 'member' | 'admin',
): Promise<MemberStatsResponse> {
  const [stats, weekly_trend] = await Promise.all([
    repo.getMemberStats(gymId, userId),
    repo.getWeeklyTrend(gymId, userId),
  ]);
  return {
    total_visits: stats.total_visits,
    visits_last_30_days: stats.visits_last_30_days,
    visits_this_week: stats.visits_this_week,
    // Admins have permanent access — no expiry date to show
    days_until_expiry: userRole === 'admin' ? null : stats.days_until_expiry,
    member_since: stats.member_since,
    weekly_trend,
  };
}

export async function getMemberProfile(gymId: string, userId: string): Promise<MemberProfileResponse> {
  const info = await repo.findMemberInfo(gymId, userId);
  if (!info) throw new NotFoundError('Member not found in this gym');

  const [membership, statsRow, weekly_trend] = await Promise.all([
    repo.findLatestByUserAndGym(gymId, userId),
    repo.getMemberStats(gymId, userId),
    repo.getWeeklyTrend(gymId, userId),
  ]);

  return {
    id: info.id,
    email: info.email,
    full_name: info.full_name,
    phone: info.phone,
    role: info.role as 'member' | 'admin',
    joined_at: info.joined_at,
    membership: {
      id: membership?.id ?? null,
      status: computeMembershipStatus(membership),
      start_date: membership?.start_date ?? null,
      end_date: membership?.end_date ?? null,
    },
    stats: {
      total_visits: statsRow.total_visits,
      visits_last_30_days: statsRow.visits_last_30_days,
      visits_this_week: statsRow.visits_this_week,
      days_until_expiry: statsRow.days_until_expiry,
      member_since: statsRow.member_since,
      weekly_trend,
    },
  };
}

export async function endMembershipForUser(gymId: string, userId: string): Promise<void> {
  const userGym = await findUserGym(userId, gymId);
  if (!userGym) throw new NotFoundError('User is not a member of this gym');
  await repo.endAllNonExpired(gymId, userId);
}

export async function patchMembership(
  gymId: string,
  membershipId: string,
  startDate: string,
  endDate: string,
): Promise<MembershipWithStatus> {
  const updated = await repo.updateDates(gymId, membershipId, startDate, endDate);
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
