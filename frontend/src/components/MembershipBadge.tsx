import type { MembershipStatus } from '../features/memberships/types';

const styles: Record<MembershipStatus, string> = {
  active: 'bg-green-500/15 text-green-700 dark:text-green-400',
  expiring_soon: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  expired: 'bg-destructive/15 text-destructive',
  none: 'bg-secondary text-muted-foreground',
};

const labels: Record<MembershipStatus, string> = {
  active: 'Active',
  expiring_soon: 'Expiring soon',
  expired: 'Expired',
  none: 'No membership',
};

export function MembershipBadge({ status }: { status: MembershipStatus }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
