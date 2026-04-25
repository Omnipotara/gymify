export type MembershipStatus = 'active' | 'expiring_soon' | 'expired' | 'none';

const EXPIRING_SOON_DAYS = 3;

export function computeMembershipStatus(
  membership: { start_date: string; end_date: string } | null,
): MembershipStatus {
  if (!membership) return 'none';

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC

  if (today < membership.start_date) return 'none'; // future membership, not yet active
  if (today > membership.end_date) return 'expired';

  const endMs = new Date(membership.end_date + 'T00:00:00Z').getTime();
  const todayMs = new Date(today + 'T00:00:00Z').getTime();
  const daysLeft = Math.round((endMs - todayMs) / 86_400_000);

  return daysLeft <= EXPIRING_SOON_DAYS ? 'expiring_soon' : 'active';
}
