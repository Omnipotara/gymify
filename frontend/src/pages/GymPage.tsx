import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

  const { data: history, isLoading } = useQuery({
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/gyms" className="text-sm text-blue-600 hover:underline">← My Gyms</Link>
          <h1 className="text-lg font-semibold text-gray-900">{gym?.name ?? 'Gym'}</h1>
        </div>
        {gym?.role === 'admin' && (
          <Link to={`/gyms/${gymId}/admin`} className="text-sm text-blue-600 hover:underline">
            Admin →
          </Link>
        )}
      </header>

      <main className="mx-auto max-w-lg p-4 space-y-4">
        {/* Membership status */}
        {membership && (
          <div className="rounded-xl bg-white px-4 py-3 shadow-sm flex items-center justify-between">
            <span className="text-sm text-gray-600">Membership</span>
            <div className="flex items-center gap-2">
              <MembershipBadge status={membership.status} />
              {membership.end_date && (
                <span className="text-xs text-gray-400">until {membership.end_date}</span>
              )}
            </div>
          </div>
        )}

        {/* Expired / no membership warning */}
        {membership && (membership.status === 'expired' || membership.status === 'none') && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {membership.status === 'expired'
              ? 'Your membership has expired. Contact the gym to renew.'
              : 'You have no active membership. Contact the gym to get started.'}
          </div>
        )}

        {/* Expiring soon warning */}
        {membership?.status === 'expiring_soon' && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            Your membership expires on {membership.end_date}. Contact the gym to renew soon.
          </div>
        )}

        {lastCheckIn && (
          <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 space-y-1">
            <p>✓ Checked in at {lastCheckIn}</p>
            {newRewards.map((r, i) => (
              <p key={i} className="font-medium">
                🎉 Reward unlocked: {r.description} ({r.discount_percent}% off)
              </p>
            ))}
          </div>
        )}

        <button
          onClick={() => { setScanning(true); setScanError(''); setLastCheckIn(''); }}
          disabled={!canCheckIn}
          className="w-full rounded-xl bg-blue-600 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Check In
        </button>

        {scanning && (
          <div className="rounded-xl bg-white p-4 shadow space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">Point camera at the check-in QR</p>
              <button onClick={() => setScanning(false)} className="text-xs text-gray-400 hover:text-gray-600">
                Cancel
              </button>
            </div>
            <QrScanner
              onScan={(payload) => checkInMutation.mutate(payload)}
              onError={(err) => setScanError(err.message)}
            />
            {scanError && <p className="text-sm text-red-600">{scanError}</p>}
            {checkInMutation.isPending && <p className="text-sm text-gray-400">Checking in…</p>}
          </div>
        )}

        {/* Personal stats */}
        {stats && (
          <div className="rounded-xl bg-white px-6 py-6 shadow-sm space-y-5 mt-2">
            <div className="grid grid-cols-3 gap-6 text-center">
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.visits_this_week}</p>
                <p className="text-xs text-gray-400 mt-0.5">This week</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.visits_last_30_days}</p>
                <p className="text-xs text-gray-400 mt-0.5">Last 30 days</p>
              </div>
              <div>
                {stats.days_until_expiry !== null ? (
                  <>
                    <p className={`text-2xl font-bold ${stats.days_until_expiry <= 3 ? 'text-amber-500' : 'text-gray-900'}`}>
                      {stats.days_until_expiry}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">Days left</p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-gray-900">{stats.total_visits}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Total visits</p>
                  </>
                )}
              </div>
            </div>

            {stats.weekly_trend.length > 0 && (
              <WeeklyTrendBars trend={stats.weekly_trend} />
            )}

            <p className="text-xs text-gray-400 text-center">
              Member since {new Date(stats.member_since).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              {stats.days_until_expiry !== null && (
                <> · {stats.total_visits} visits total</>
              )}
            </p>
          </div>
        )}

        {/* Unredeemed rewards */}
        {rewardsData && rewardsData.items.length > 0 && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 space-y-1.5">
            <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Your Rewards</p>
            {rewardsData.items.map((r) => (
              <div key={r.id} className="flex items-center justify-between">
                <span className="text-sm text-amber-900">{r.rule_description}</span>
                <span className="text-sm font-semibold text-amber-800">{r.discount_percent}% off</span>
              </div>
            ))}
            <p className="text-xs text-amber-600">Show these to the gym desk to redeem.</p>
          </div>
        )}

        <div className="space-y-2">
          <h2 className="text-sm font-medium text-gray-500">Recent visits</h2>
          {isLoading && <p className="text-center text-gray-400 py-4">Loading…</p>}
          {history?.items.length === 0 && (
            <p className="text-center text-gray-400 py-4">No check-ins yet.</p>
          )}
          {history?.items.map((ci) => (
            <div key={ci.id} className="rounded-lg bg-white px-4 py-3 shadow-sm text-sm text-gray-700">
              {new Date(ci.checked_in_at).toLocaleString()}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
