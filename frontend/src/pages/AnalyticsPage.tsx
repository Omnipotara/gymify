import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { getDashboard } from '../features/dashboard/api';

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', timeZone: 'UTC',
  });
}

function daysSince(isoTimestamp: string | null): string {
  if (!isoTimestamp) return 'Never visited';
  const days = Math.floor((Date.now() - new Date(isoTimestamp).getTime()) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

function StatCard({
  label,
  value,
  variant = 'default',
}: {
  label: string;
  value: number;
  variant?: 'default' | 'success' | 'warning';
}) {
  const colors = {
    default: 'bg-primary/10 text-primary',
    success: 'bg-green-500/10 text-green-700 dark:text-green-400',
    warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  };
  return (
    <div className={`rounded-2xl p-4 ${colors[variant]}`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="font-heading text-4xl font-bold mt-1">{value}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const { gymId } = useParams<{ gymId: string }>();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', gymId],
    queryFn: () => getDashboard(gymId!),
    enabled: !!gymId,
    refetchInterval: 60_000,
  });

  const chartColors = {
    grid: isDark ? '#1f2b42' : '#f0f0f0',
    tick: isDark ? '#6b7a99' : '#9ca3af',
    stroke: '#3263cf',
    tooltip: isDark ? '#0f1523' : '#ffffff',
  };

  return (
    <main className="mx-auto max-w-3xl p-4 space-y-4">
      {isLoading && (
        <p className="text-center text-muted-foreground py-12 text-sm">Loading…</p>
      )}

      {data && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Total Members" value={data.stats.total_members} variant="default" />
            <StatCard label="Active This Week" value={data.stats.active_members} variant="success" />
            <StatCard
              label="Needs Attention"
              value={data.stats.inactive_members}
              variant={data.stats.inactive_members > 0 ? 'warning' : 'default'}
            />
          </div>

          {/* Visit trend chart */}
          <div className="rounded-2xl bg-card border border-border p-5">
            <h2 className="text-sm font-medium text-muted-foreground mb-4">Visits — last 30 days</h2>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data.visit_trend}>
                <defs>
                  <linearGradient id="visitGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3263cf" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3263cf" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fontSize: 11, fill: chartColors.tick }}
                  interval={6}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: chartColors.tick }}
                  width={24}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  labelFormatter={formatDate}
                  formatter={(v: number) => [v, 'visits']}
                  contentStyle={{
                    background: chartColors.tooltip,
                    border: `1px solid ${chartColors.grid}`,
                    borderRadius: '0.75rem',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="visits"
                  stroke={chartColors.stroke}
                  strokeWidth={2}
                  fill="url(#visitGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Needs attention */}
            <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
              <div>
                <h2 className="text-sm font-medium text-foreground">Needs attention</h2>
                <p className="text-xs text-muted-foreground">Active membership, no visit in 14+ days</p>
              </div>
              {data.inactive.length === 0 ? (
                <p className="text-sm text-muted-foreground">All active members are showing up.</p>
              ) : (
                <ul className="space-y-2">
                  {data.inactive.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {m.full_name ?? m.email}
                        </p>
                        {m.full_name && (
                          <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                        )}
                      </div>
                      <span className="text-xs text-amber-600 dark:text-amber-400 whitespace-nowrap shrink-0">
                        {daysSince(m.last_visit)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Top visitors */}
            <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
              <div>
                <h2 className="text-sm font-medium text-foreground">Top visitors</h2>
                <p className="text-xs text-muted-foreground">Last 30 days</p>
              </div>
              {data.top_visitors.length === 0 ? (
                <p className="text-sm text-muted-foreground">No visits recorded yet.</p>
              ) : (
                <ul className="space-y-2">
                  {data.top_visitors.map((m, i) => (
                    <li key={m.id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {m.full_name ?? m.email}
                          </p>
                          {m.full_name && (
                            <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-xs font-medium text-primary whitespace-nowrap shrink-0">
                        {m.visit_count} visit{m.visit_count !== 1 ? 's' : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
