import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMembers, createMembership, patchMembership, endMembershipsForUser } from '../features/memberships/api';
import { MembershipBadge } from '../components/MembershipBadge';
import { ApiError } from '../lib/api-client';
import type { MemberWithStatus, MembershipStatus } from '../features/memberships/types';

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function MembershipForm({
  gymId,
  member,
  onClose,
}: {
  gymId: string;
  member: MemberWithStatus;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const isModify = member.membership.status === 'active' || member.membership.status === 'expiring_soon';

  // Modify: pre-fill from existing record. Add: default to today → +30 days.
  const [startDate, setStartDate] = useState(
    isModify && member.membership.start_date ? member.membership.start_date : today(),
  );
  const [endDate, setEndDate] = useState(
    isModify && member.membership.end_date ? member.membership.end_date : addDays(today(), 30),
  );
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      isModify && member.membership.id
        ? patchMembership(gymId, member.membership.id, { start_date: startDate, end_date: endDate })
        : createMembership(gymId, { user_id: member.id, start_date: startDate, end_date: endDate }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', gymId] });
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to save'),
  });

  return (
    <div className="mt-3 border-t pt-3 space-y-3">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        {isModify ? 'Modify Membership' : 'Add Membership'}
      </p>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs text-gray-500">Start</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-0.5 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs text-gray-500">End</label>
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-0.5 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {mutation.isPending ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={onClose}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function EndMembershipButton({
  gymId,
  userId,
}: {
  gymId: string;
  userId: string;
}) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const mutation = useMutation({
    // Ends ALL active and future memberships for this user in one shot
    mutationFn: () => endMembershipsForUser(gymId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', gymId] });
      setConfirming(false);
    },
  });

  if (confirming) {
    return (
      <span className="flex items-center gap-1">
        <span className="text-xs text-gray-500">End now?</span>
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="text-xs text-red-600 hover:underline disabled:opacity-50"
        >
          {mutation.isPending ? '…' : 'Yes'}
        </button>
        <button onClick={() => setConfirming(false)} className="text-xs text-gray-400 hover:underline">
          No
        </button>
      </span>
    );
  }

  return (
    <button onClick={() => setConfirming(true)} className="text-xs text-red-500 hover:underline">
      End
    </button>
  );
}

export default function AdminPage() {
  const { gymId } = useParams<{ gymId: string }>();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['members', gymId],
    queryFn: () => getMembers(gymId!),
    enabled: !!gymId,
  });

  const expiringSoon = data?.items.filter((m) => m.membership.status === 'expiring_soon') ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white px-4 py-3 flex items-center gap-3">
        <Link to={`/gyms/${gymId}`} className="text-sm text-blue-600 hover:underline">
          ← Member View
        </Link>
        <h1 className="text-lg font-semibold text-gray-900">Members</h1>
        <div className="ml-auto flex items-center gap-4">
          <Link to={`/gyms/${gymId}/admin/rewards`} className="text-sm text-blue-600 hover:underline">
            Rewards
          </Link>
          <Link to={`/gyms/${gymId}/admin/analytics`} className="text-sm text-blue-600 hover:underline">
            Analytics →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg p-4 space-y-3">
        {expiringSoon.length > 0 && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            ⚠️ {expiringSoon.length} membership{expiringSoon.length > 1 ? 's' : ''} expiring within 3 days:{' '}
            {expiringSoon.map((m) => m.full_name ?? m.email).join(', ')}
          </div>
        )}

        <h2 className="text-sm font-medium text-gray-500">
          {data ? `${data.items.length} member${data.items.length !== 1 ? 's' : ''}` : 'Members'}
        </h2>

        {isLoading && <p className="text-center text-gray-400 py-8">Loading…</p>}

        {data?.items.map((member) => {
          const isActive = member.membership.status === 'active' || member.membership.status === 'expiring_soon';
          return (
            <div key={member.id} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {member.full_name ?? member.email}
                  </p>
                  {member.full_name && (
                    <p className="text-xs text-gray-400">{member.email}</p>
                  )}
                  {member.membership.end_date && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      until {member.membership.end_date}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <MembershipBadge status={member.membership.status} />
                  {isActive && (
                    <EndMembershipButton gymId={gymId!} userId={member.id} />
                  )}
                  <button
                    onClick={() => setExpandedId(expandedId === member.id ? null : member.id)}
                    className="text-xs text-blue-600 hover:underline whitespace-nowrap"
                  >
                    {expandedId === member.id ? 'Cancel' : isActive ? 'Modify' : '+ Add'}
                  </button>
                </div>
              </div>

              {expandedId === member.id && (
                <MembershipForm
                  gymId={gymId!}
                  member={member}
                  onClose={() => setExpandedId(null)}
                />
              )}
            </div>
          );
        })}
      </main>
    </div>
  );
}
