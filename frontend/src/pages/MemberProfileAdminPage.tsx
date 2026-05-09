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
      {isLoading && (
        <p className="text-center text-muted-foreground py-12 text-sm">Loading…</p>
      )}

      {data && (
        <>
          {/* Identity card */}
          <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                {data.full_name && (
                  <p className="font-heading text-xl font-bold text-foreground">{data.full_name}</p>
                )}
                <p className="text-sm text-muted-foreground truncate">{data.email}</p>
                {data.phone ? (
                  <p className="text-sm text-foreground">{data.phone}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No phone number</p>
                )}
              </div>
              <MembershipBadge status={data.membership.status} />
            </div>
            <div className="pt-1 border-t border-border space-y-1">
              {data.membership.end_date && (
                <p className="text-xs text-muted-foreground">
                  Membership until {data.membership.end_date}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Joined {new Date(data.joined_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Stats card */}
          <div className="rounded-2xl bg-card border border-border px-5 py-5 space-y-5">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="font-heading text-3xl font-bold text-foreground">
                  {data.stats.visits_this_week}
                </p>
                <p className="text-xs text-muted-foreground mt-1">This week</p>
              </div>
              <div>
                <p className="font-heading text-3xl font-bold text-foreground">
                  {data.stats.visits_last_30_days}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
              </div>
              <div>
                <p className="font-heading text-3xl font-bold text-foreground">
                  {data.stats.total_visits}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Total visits</p>
              </div>
            </div>

            {data.stats.weekly_trend.length > 0 && (
              <WeeklyTrendBars trend={data.stats.weekly_trend} />
            )}

            <p className="text-xs text-muted-foreground text-center">
              Member since {new Date(data.stats.member_since).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
          </div>
        </>
      )}
    </main>
  );
}
