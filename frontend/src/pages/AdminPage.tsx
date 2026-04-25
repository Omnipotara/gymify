import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMembers, createMembership } from '../features/memberships/api';
import { MembershipBadge } from '../components/MembershipBadge';
import { ApiError } from '../lib/api-client';
import type { MemberWithStatus } from '../features/memberships/types';

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function AddMembershipForm({
  gymId,
  member,
  onClose,
}: {
  gymId: string;
  member: MemberWithStatus;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(daysFromNow(30));
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      createMembership(gymId, { user_id: member.id, start_date: startDate, end_date: endDate }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', gymId] });
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to create membership'),
  });

  return (
    <div className="mt-3 border-t pt-3 space-y-3">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Add Membership</p>
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
            onChange={(e) => setEndDate(e.target.value)}
            min={startDate}
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

export default function AdminPage() {
  const { gymId } = useParams<{ gymId: string }>();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['members', gymId],
    queryFn: () => getMembers(gymId!),
    enabled: !!gymId,
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white px-4 py-3 flex items-center gap-3">
        <Link to={`/gyms/${gymId}`} className="text-sm text-blue-600 hover:underline">
          ← Member View
        </Link>
        <h1 className="text-lg font-semibold text-gray-900">Admin Dashboard</h1>
      </header>

      <main className="mx-auto max-w-lg p-4 space-y-3">
        <h2 className="text-sm font-medium text-gray-500">
          {data ? `${data.items.length} member${data.items.length !== 1 ? 's' : ''}` : 'Members'}
        </h2>

        {isLoading && <p className="text-center text-gray-400 py-8">Loading…</p>}

        {data?.items.map((member) => (
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
                <button
                  onClick={() =>
                    setExpandedId(expandedId === member.id ? null : member.id)
                  }
                  className="text-xs text-blue-600 hover:underline"
                >
                  {expandedId === member.id ? 'Cancel' : '+ Membership'}
                </button>
              </div>
            </div>

            {expandedId === member.id && (
              <AddMembershipForm
                gymId={gymId!}
                member={member}
                onClose={() => setExpandedId(null)}
              />
            )}
          </div>
        ))}
      </main>
    </div>
  );
}
