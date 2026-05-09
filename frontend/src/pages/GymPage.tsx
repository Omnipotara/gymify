import { useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QrCode, Gift, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { getCheckInHistory, checkIn } from '../features/checkins/api';
import { getMyMembership, getMemberStats } from '../features/memberships/api';
import { getMyRewards } from '../features/rewards/api';
import { getMyGyms } from '../features/gyms/api';
import { QrScanner } from '../components/QrScanner';
import { MembershipBadge } from '../components/MembershipBadge';
import { WeeklyTrendBars } from '../components/WeeklyTrendBars';
import { ApiError } from '../lib/api-client';
import type { RewardSummary } from '../features/rewards/types';

export default function GymPage() {
  const { gymId } = useParams<{ gymId: string }>();
  const queryClient = useQueryClient();
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [lastCheckIn, setLastCheckIn] = useState('');
  const [newRewards, setNewRewards] = useState<RewardSummary[]>([]);

  const { data: gymsData } = useQuery({ queryKey: ['my-gyms'], queryFn: getMyGyms });
  const gym = gymsData?.gyms.find((g) => g.id === gymId);

  const { data: membership } = useQuery({
    queryKey: ['membership', gymId],
    queryFn: () => getMyMembership(gymId!),
    enabled: !!gymId,
  });

  const { data: stats } = useQuery({
    queryKey: ['member-stats', gymId],
    queryFn: () => getMemberStats(gymId!),
    enabled: !!gymId,
  });

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['check-ins', gymId],
    queryFn: () => getCheckInHistory(gymId!),
    enabled: !!gymId,
  });

  const { data: rewardsData } = useQuery({
    queryKey: ['my-rewards', gymId],
    queryFn: () => getMyRewards(gymId!),
    enabled: !!gymId,
  });

  const checkInMutation = useMutation({
    mutationFn: (payload: unknown) => checkIn(gymId!, payload),
    onSuccess: (ci) => {
      queryClient.invalidateQueries({ queryKey: ['check-ins', gymId] });
      queryClient.invalidateQueries({ queryKey: ['member-stats', gymId] });
      queryClient.invalidateQueries({ queryKey: ['my-rewards', gymId] });
      setScanning(false);
      setScanError('');
      setLastCheckIn(new Date(ci.checked_in_at).toLocaleTimeString());
      setNewRewards(ci.new_rewards ?? []);
    },
    onError: (err) => {
      setScanError(err instanceof ApiError ? err.message : 'Check-in failed');
    },
  });

  const canCheckIn = membership?.status === 'active' || membership?.status === 'expiring_soon';

  if (gymsData && gym?.role === 'admin') {
    return <Navigate to={`/gyms/${gymId}/admin`} replace />;
  }

  return (
    <main className="mx-auto max-w-lg p-4 space-y-4">
      {/* ── Check-in card ── */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="px-5 py-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-2xl font-bold">Check In</h2>
            {membership && <MembershipBadge status={membership.status} />}
          </div>

          {/* Membership warnings */}
          {membership?.status === 'expired' && (
            <div className="flex items-start gap-2.5 rounded-xl bg-destructive/10 border border-destructive/20 px-3 py-3">
              <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-sm text-destructive">
                Your membership has expired. Contact the gym to renew.
              </p>
            </div>
          )}
          {membership?.status === 'none' && (
            <div className="flex items-start gap-2.5 rounded-xl bg-destructive/10 border border-destructive/20 px-3 py-3">
              <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-sm text-destructive">
                No active membership. Contact the gym to get started.
              </p>
            </div>
          )}
          {membership?.status === 'expiring_soon' && (
            <div className="flex items-start gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Expires {membership.end_date}. Renew soon.
              </p>
            </div>
          )}

          {/* Success banner */}
          {lastCheckIn && (
            <div className="rounded-xl bg-green-500/10 border border-green-500/20 px-3 py-3 space-y-1.5">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <p className="text-sm font-medium">Checked in at {lastCheckIn}</p>
              </div>
              {newRewards.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <Gift className="w-3.5 h-3.5 shrink-0" />
                  <p className="text-sm font-medium">
                    Reward: {r.description} ({r.discount_percent}% off)
                  </p>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => { setScanning(true); setScanError(''); setLastCheckIn(''); setNewRewards([]); }}
            disabled={!canCheckIn || scanning}
            className="w-full rounded-xl bg-primary text-primary-foreground py-4 text-base font-semibold
              hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors
              flex items-center justify-center gap-2.5"
          >
            <QrCode className="w-5 h-5" />
            Scan to Check In
          </button>
        </div>

        {scanning && (
          <div className="border-t border-border px-5 pb-5 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Point camera at the check-in QR</p>
              <button
                onClick={() => setScanning(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
            <QrScanner
              onScan={(payload) => checkInMutation.mutate(payload)}
              onError={(err) => setScanError(err.message)}
            />
            {scanError && <p className="text-sm text-destructive">{scanError}</p>}
            {checkInMutation.isPending && (
              <p className="text-sm text-muted-foreground text-center">Checking in…</p>
            )}
          </div>
        )}
      </div>

      {/* ── Stats card ── */}
      {stats && (
        <div className="rounded-2xl bg-card border border-border px-5 py-5 space-y-5">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="font-heading text-3xl font-bold text-foreground">
                {stats.visits_this_week}
              </p>
              <p className="text-xs text-muted-foreground mt-1">This week</p>
            </div>
            <div>
              <p className="font-heading text-3xl font-bold text-foreground">
                {stats.visits_last_30_days}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
            </div>
            <div>
              {stats.days_until_expiry !== null ? (
                <>
                  <p className={`font-heading text-3xl font-bold ${
                    stats.days_until_expiry <= 3 ? 'text-amber-500' : 'text-foreground'
                  }`}>
                    {stats.days_until_expiry}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Days left</p>
                </>
              ) : (
                <>
                  <p className="font-heading text-3xl font-bold text-foreground">
                    {stats.total_visits}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Total</p>
                </>
              )}
            </div>
          </div>

          {stats.weekly_trend.length > 0 && <WeeklyTrendBars trend={stats.weekly_trend} />}

          <p className="text-xs text-muted-foreground text-center">
            Member since {new Date(stats.member_since).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            {stats.days_until_expiry !== null && <> · {stats.total_visits} total visits</>}
          </p>
        </div>
      )}

      {/* ── Unredeemed rewards ── */}
      {rewardsData && rewardsData.items.length > 0 && (
        <div className="rounded-2xl bg-primary/10 border border-primary/20 px-4 py-4 space-y-2">
          <div className="flex items-center gap-2">
            <Gift className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold text-primary">Your Rewards</p>
          </div>
          {rewardsData.items.map((r) => (
            <div key={r.id} className="flex items-center justify-between">
              <span className="text-sm text-foreground">{r.rule_description}</span>
              <span className="text-sm font-semibold text-primary">{r.discount_percent}% off</span>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">Show these to the gym desk to redeem.</p>
        </div>
      )}

      {/* ── Recent visits ── */}
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground px-1">Recent visits</h2>
        {historyLoading && (
          <p className="text-center text-muted-foreground py-4 text-sm">Loading…</p>
        )}
        {!historyLoading && history?.items.length === 0 && (
          <p className="text-center text-muted-foreground py-4 text-sm">No check-ins yet.</p>
        )}
        {history?.items.map((ci) => (
          <div
            key={ci.id}
            className="rounded-xl bg-card border border-border px-4 py-3 text-sm text-foreground"
          >
            {new Date(ci.checked_in_at).toLocaleString()}
          </div>
        ))}
      </div>
    </main>
  );
}
