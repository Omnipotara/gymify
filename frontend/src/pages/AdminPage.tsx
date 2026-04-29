import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import QRCode from 'react-qr-code';
import { getMembers, createMembership, patchMembership, endMembershipsForUser } from '../features/memberships/api';
import { getGymCheckInLog } from '../features/checkins/api';
import { getJoinQrPayload } from '../features/gyms/api';
import { MembershipBadge } from '../components/MembershipBadge';
import { ApiError } from '../lib/api-client';
import type { MemberWithStatus, MembershipStatus } from '../features/memberships/types';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function JoinQrPanel({ gymId }: { gymId: string }) {
  const svgContainerId = `join-qr-${gymId}`;

  const { data, isLoading } = useQuery({
    queryKey: ['join-qr', gymId],
    queryFn: () => getJoinQrPayload(gymId),
    staleTime: Infinity,
  });

  const qrValue = data ? JSON.stringify(data.payload) : '';

  const downloadSvg = () => {
    const el = document.getElementById(svgContainerId)?.querySelector('svg');
    if (!el) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(el);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `join-qr.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div id={svgContainerId} className="rounded-lg bg-white p-3 shadow-sm border border-gray-100">
        {isLoading ? (
          <div className="w-32 h-32 flex items-center justify-center">
            <div className="h-5 w-5 rounded-full border-2 border-gray-300 border-t-blue-500 animate-spin" />
          </div>
        ) : qrValue ? (
          <QRCode value={qrValue} size={128} />
        ) : null}
      </div>
      <div className="flex gap-2">
        <button
          onClick={downloadSvg}
          disabled={!qrValue}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
        >
          Download SVG
        </button>
      </div>
      <p className="text-xs text-gray-400 text-center">Static — share once with new members</p>
    </div>
  );
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
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showQr, setShowQr] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['members', gymId],
    queryFn: () => getMembers(gymId!),
    enabled: !!gymId,
  });

  const { data: logData } = useQuery({
    queryKey: ['gym-checkin-log', gymId],
    queryFn: () => getGymCheckInLog(gymId!),
    enabled: !!gymId,
    refetchInterval: 5000,
  });

  const expiringSoon = data?.items.filter((m) => m.membership.status === 'expiring_soon') ?? [];

  const duplicateNames = new Set(
    (data?.items ?? [])
      .map((m) => m.full_name)
      .filter((name): name is string => !!name)
      .filter((name, _, arr) => arr.filter((n) => n === name).length > 1),
  );

  const filteredMembers = data?.items.filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (m.full_name ?? '').toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q)
    );
  }) ?? [];

  return (
    <main className="mx-auto max-w-5xl p-4">
        <div className="flex gap-8 items-start">
          {/* ── Members column ── */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* QR Codes section */}
            <div className="rounded-xl bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">QR Codes</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => window.open(`/gyms/${gymId}/checkin-display`, '_blank')}
                    className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg"
                  >
                    Open Check-in Display
                  </button>
                  <button
                    onClick={() => setShowQr(!showQr)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {showQr ? 'Hide Join QR' : 'Show Join QR'}
                  </button>
                </div>
              </div>
              {showQr && (
                <div className="border-t px-4 py-4">
                  <JoinQrPanel gymId={gymId!} />
                </div>
              )}
            </div>

            {expiringSoon.length > 0 && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                ⚠️ {expiringSoon.length} membership{expiringSoon.length > 1 ? 's' : ''} expiring within 3 days:{' '}
                {expiringSoon.map((m) => m.full_name ?? m.email).join(', ')}
              </div>
            )}

            <div className="flex items-center gap-3">
              <h2 className="text-sm font-medium text-gray-500 shrink-0">
                {data ? `${filteredMembers.length}${search.trim() ? ` of ${data.items.length}` : ''} member${data.items.length !== 1 ? 's' : ''}` : 'Members'}
              </h2>
              <input
                type="text"
                placeholder="Search by name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            {isLoading && <p className="text-center text-gray-400 py-8">Loading…</p>}

            {!isLoading && filteredMembers.length === 0 && search.trim() && (
              <p className="text-center text-gray-400 py-6 text-sm">No members match "{search}".</p>
            )}

            {filteredMembers.map((member) => {
              const isActive = member.membership.status === 'active' || member.membership.status === 'expiring_soon';
              return (
                <div key={member.id} className="rounded-xl bg-white shadow-sm overflow-hidden">
                  <div
                    onClick={() => navigate(`/gyms/${gymId}/admin/members/${member.id}`)}
                    className="p-4 flex items-start justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {member.full_name ?? member.email}
                      </p>
                      {(member.full_name && duplicateNames.has(member.full_name)) && (
                        <p className="text-xs text-gray-400">{member.email}</p>
                      )}
                      {member.membership.end_date && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          until {member.membership.end_date}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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
                    <div className="px-4 pb-4 border-t" onClick={(e) => e.stopPropagation()}>
                      <MembershipForm
                        gymId={gymId!}
                        member={member}
                        onClose={() => setExpandedId(null)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Live check-in log ── */}
          <div className="w-72 shrink-0">
            <div className="rounded-xl bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-3 flex items-center gap-2 border-b border-gray-100">
                <h2 className="text-sm font-medium text-gray-700">Live Check-ins</h2>
                <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              </div>
              {!logData || logData.items.length === 0 ? (
                <p className="text-center text-gray-400 py-8 text-sm">No check-ins today.</p>
              ) : (
                <ul className="divide-y max-h-[600px] overflow-y-auto">
                  {logData.items.map((entry) => (
                    <li key={entry.id} className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {entry.member_name ?? entry.member_email}
                      </p>
                      {entry.member_name && (
                        <p className="text-xs text-gray-400 truncate">{entry.member_email}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">{timeAgo(entry.checked_in_at)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </main>
  );
}
