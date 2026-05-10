import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, QrCode } from 'lucide-react';
import QRCode from 'react-qr-code';
import { getMembers, createMembership, patchMembership, endMembershipsForUser } from '../features/memberships/api';
import { getGymCheckInLog } from '../features/checkins/api';
import { getJoinQrPayload, getCheckinQrPayload } from '../features/gyms/api';
import { MembershipBadge } from '../components/MembershipBadge';
import { ApiError } from '../lib/api-client';
import type { MemberWithStatus } from '../features/memberships/types';

const inputCls =
  'w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground ' +
  'focus:outline-none focus:ring-2 focus:ring-ring';

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
    a.download = 'join-qr.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <div id={svgContainerId} className="rounded-xl bg-white p-3 border border-border">
        {isLoading ? (
          <div className="w-32 h-32 flex items-center justify-center">
            <div className="h-5 w-5 rounded-full border-2 border-border border-t-primary animate-spin" />
          </div>
        ) : qrValue ? (
          <QRCode value={qrValue} size={128} />
        ) : null}
      </div>
      <button
        onClick={downloadSvg}
        disabled={!qrValue}
        className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground
          hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-40"
      >
        Download SVG
      </button>
      <p className="text-xs text-muted-foreground text-center">
        Static — share once with new members
      </p>
    </div>
  );
}

const CHECKIN_QR_REFRESH_MS = 28_000;

function CheckinQrPanel({ gymId }: { gymId: string }) {
  const [qrValue, setQrValue] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [error, setError] = useState('');

  const fetchQr = useCallback(async () => {
    try {
      setError('');
      const data = await getCheckinQrPayload(gymId);
      setQrValue(JSON.stringify(data.payload));
      setExpiresAt(data.expires_at);
    } catch {
      setError('Failed to load QR code.');
    }
  }, [gymId]);

  useEffect(() => {
    fetchQr();
    const id = setInterval(fetchQr, CHECKIN_QR_REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchQr]);

  useEffect(() => {
    if (expiresAt === 0) return;
    const id = setInterval(() => {
      setTimeLeft(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    }, 200);
    return () => clearInterval(id);
  }, [expiresAt]);

  const progress = expiresAt > 0 ? Math.max(0, (expiresAt - Date.now()) / 30_000) * 100 : 100;

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <div className="rounded-xl bg-white p-3 border border-border">
        {error ? (
          <div className="w-32 h-32 flex items-center justify-center">
            <p className="text-xs text-destructive text-center">{error}</p>
          </div>
        ) : qrValue ? (
          <QRCode value={qrValue} size={128} />
        ) : (
          <div className="w-32 h-32 flex items-center justify-center">
            <div className="h-5 w-5 rounded-full border-2 border-border border-t-primary animate-spin" />
          </div>
        )}
      </div>
      <div className="w-full max-w-[160px] space-y-1">
        <div className="h-1 w-full rounded-full bg-secondary overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-none" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-xs text-muted-foreground text-center">
          {timeLeft > 0 ? `Refreshes in ${timeLeft}s` : 'Refreshing…'}
        </p>
      </div>
      <button
        onClick={() => window.open(`/gyms/${gymId}/checkin-display`, '_blank')}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ExternalLink className="w-3 h-3" />
        Full-screen kiosk
      </button>
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
    <div className="mt-3 pt-3 border-t border-border space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {isModify ? 'Modify Membership' : 'Add Membership'}
      </p>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground">Start</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls + ' mt-0.5'} />
        </div>
        <div className="flex-1">
          <label className="text-xs text-muted-foreground">End</label>
          <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls + ' mt-0.5'} />
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground
            hover:bg-primary/90 disabled:opacity-50"
        >
          {mutation.isPending ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={onClose}
          className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground
            hover:bg-secondary hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function EndMembershipButton({ gymId, userId }: { gymId: string; userId: string }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const mutation = useMutation({
    mutationFn: () => endMembershipsForUser(gymId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', gymId] });
      setConfirming(false);
    },
  });

  if (confirming) {
    return (
      <span className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground">End now?</span>
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="text-xs text-destructive hover:underline disabled:opacity-50"
        >
          {mutation.isPending ? '…' : 'Yes'}
        </button>
        <button onClick={() => setConfirming(false)} className="text-xs text-muted-foreground hover:underline">
          No
        </button>
      </span>
    );
  }

  return (
    <button onClick={() => setConfirming(true)} className="text-xs text-destructive hover:underline">
      End
    </button>
  );
}

export default function AdminPage() {
  const { gymId } = useParams<{ gymId: string }>();
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showJoinQr, setShowJoinQr] = useState(false);
  const [showCheckinQr, setShowCheckinQr] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['members', gymId],
    queryFn: () => getMembers(gymId!),
    enabled: !!gymId,
    refetchInterval: 15_000,
  });

  const { data: logData } = useQuery({
    queryKey: ['gym-checkin-log', gymId],
    queryFn: () => getGymCheckInLog(gymId!),
    enabled: !!gymId,
    refetchInterval: 5_000,
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
    return (m.full_name ?? '').toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
  }) ?? [];

  return (
    <main className="mx-auto max-w-5xl p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:gap-6 lg:items-start">
        {/* ── Members column ── */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* QR Codes */}
          <div className={`rounded-2xl bg-card overflow-hidden ${showCheckinQr || showJoinQr ? 'border-2 border-primary/40' : 'border border-border'}`}>
            <div className="px-4 py-3 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 mr-auto">
                <QrCode className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm font-medium">QR Codes</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowCheckinQr(!showCheckinQr); setShowJoinQr(false); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${showCheckinQr ? 'bg-primary text-primary-foreground' : 'border border-border text-foreground hover:bg-secondary'}`}
                >
                  Check-in QR
                </button>
                <button
                  onClick={() => { setShowJoinQr(!showJoinQr); setShowCheckinQr(false); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${showJoinQr ? 'bg-primary text-primary-foreground' : 'border border-border text-foreground hover:bg-secondary'}`}
                >
                  Join QR
                </button>
              </div>
            </div>
            {showCheckinQr && (
              <div className="border-t border-border px-4 py-4">
                <CheckinQrPanel gymId={gymId!} />
              </div>
            )}
            {showJoinQr && (
              <div className="border-t border-border px-4 py-4">
                <JoinQrPanel gymId={gymId!} />
              </div>
            )}
          </div>

          {/* Expiring soon alert */}
          {expiringSoon.length > 0 && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
              ⚠️ {expiringSoon.length} membership{expiringSoon.length > 1 ? 's' : ''} expiring within 3 days:{' '}
              {expiringSoon.map((m) => m.full_name ?? m.email).join(', ')}
            </div>
          )}

          {/* Search + count */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground shrink-0 flex items-center gap-1.5">
              {data
                ? `${filteredMembers.length}${search.trim() ? ` of ${data.items.length}` : ''} member${data.items.length !== 1 ? 's' : ''}`
                : 'Members'}
              <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" title="Auto-updating" />
            </span>
            <input
              type="text"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground
                placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {isLoading && (
            <p className="text-center text-muted-foreground py-8 text-sm">Loading…</p>
          )}
          {!isLoading && filteredMembers.length === 0 && search.trim() && (
            <p className="text-center text-muted-foreground py-6 text-sm">No members match "{search}".</p>
          )}

          {/* Member list */}
          {filteredMembers.map((member) => {
            const isActive = member.membership.status === 'active' || member.membership.status === 'expiring_soon';
            const isExpanded = expandedId === member.id;
            return (
              <div key={member.id} className={`rounded-2xl bg-card overflow-hidden ${isExpanded ? 'border-2 border-primary/40' : 'border border-border'}`}>
                <div
                  onClick={() => navigate(`/gyms/${gymId}/admin/members/${member.id}`)}
                  className="p-4 flex items-start justify-between gap-3 cursor-pointer
                    hover:bg-secondary/50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {member.full_name ?? member.email}
                    </p>
                    {member.full_name && duplicateNames.has(member.full_name) && (
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                    )}
                    {member.membership.end_date && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        until {member.membership.end_date}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <MembershipBadge status={member.membership.status} />
                    {isActive && <EndMembershipButton gymId={gymId!} userId={member.id} />}
                    <button
                      onClick={() => setExpandedId(expandedId === member.id ? null : member.id)}
                      className="text-xs text-primary hover:underline whitespace-nowrap"
                    >
                      {expandedId === member.id ? 'Cancel' : isActive ? 'Modify' : '+ Add'}
                    </button>
                  </div>
                </div>

                {expandedId === member.id && (
                  <div className="px-4 pb-4 border-t border-border" onClick={(e) => e.stopPropagation()}>
                    <MembershipForm gymId={gymId!} member={member} onClose={() => setExpandedId(null)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Live check-in log ── */}
        <div className="w-full lg:w-72 lg:shrink-0">
          <div className="rounded-2xl bg-card border border-border overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-2 border-b border-border">
              <h2 className="text-sm font-medium">Live Check-ins</h2>
              <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
            </div>
            {!logData || logData.items.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">No check-ins today.</p>
            ) : (
              <ul className="divide-y divide-border max-h-[600px] overflow-y-auto">
                {logData.items.map((entry) => (
                  <li key={entry.id} className="px-4 py-3">
                    <p className="text-sm font-medium text-foreground truncate">
                      {entry.member_name ?? entry.member_email}
                    </p>
                    {entry.member_name && (
                      <p className="text-xs text-muted-foreground truncate">{entry.member_email}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(entry.checked_in_at)}</p>
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
