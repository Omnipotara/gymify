import type { MembershipStatus } from '../features/memberships/types';

const styles: Record<MembershipStatus, string> = {
  active: 'bg-green-100 text-green-800',
  expiring_soon: 'bg-amber-100 text-amber-800',
  expired: 'bg-red-100 text-red-700',
  none: 'bg-gray-100 text-gray-500',
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
