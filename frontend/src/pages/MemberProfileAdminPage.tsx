import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getMemberProfile } from '../features/users/api';
import { MembershipBadge } from '../components/MembershipBadge';
import { WeeklyTrendBars } from '../components/WeeklyTrendBars';

export default function MemberProfileAdminPage() {
  const { gymId, userId } = useParams<{ gymId: string; userId: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['member-profile', gymId, userId],
    queryFn: () => getMemberProfile(gymId!, userId!),
    enabled: !!gymId && !!userId,
  });

  return (
    <main className="mx-auto max-w-lg p-4 space-y-4">
        {isLoading && <p className="text-center text-gray-400 py-8">Loading…</p>}

        {data && (
          <>
            {/* Identity card */}
            <div className="rounded-xl bg-white p-4 shadow-sm space-y-2">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  {data.full_name && (
                    <p className="text-base font-semibold text-gray-900">{data.full_name}</p>
                  )}
                  <p className="text-sm text-gray-500">{data.email}</p>
                  {data.phone ? (
                    <p className="text-sm text-gray-700">{data.phone}</p>
                  ) : (
                    <p className="text-sm text-gray-400 italic">No phone number</p>
                  )}
                </div>
                <MembershipBadge status={data.membership.status} />
              </div>
              {data.membership.end_date && (
                <p className="text-xs text-gray-400">
                  Membership until {data.membership.end_date}
                </p>
              )}
              <p className="text-xs text-gray-400">
                Joined {new Date(data.joined_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
            </div>

            {/* Stats */}
            <div className="rounded-xl bg-white px-4 py-4 shadow-sm space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-2xl font-bold text-gray-900">{data.stats.visits_this_week}</p>
                  <p className="text-xs text-gray-400 mt-0.5">This week</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{data.stats.visits_last_30_days}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Last 30 days</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{data.stats.total_visits}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Total visits</p>
                </div>
              </div>

              {data.stats.weekly_trend.length > 0 && (
                <WeeklyTrendBars trend={data.stats.weekly_trend} />
              )}

              <p className="text-xs text-gray-400 text-center">
                Member since {new Date(data.stats.member_since).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
            </div>
          </>
        )}
      </main>
  );
}
