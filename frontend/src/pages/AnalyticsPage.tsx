import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-xl p-4 ${color}`}>
      <p className="text-sm font-medium opacity-75">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const { gymId } = useParams<{ gymId: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', gymId],
    queryFn: () => getDashboard(gymId!),
    enabled: !!gymId,
    refetchInterval: 60_000,
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white px-4 py-3 flex items-center gap-3">
        <Link to={`/gyms/${gymId}/admin`} className="text-sm text-blue-600 hover:underline">
          ← Members
        </Link>
        <h1 className="text-lg font-semibold text-gray-900">Analytics</h1>
      </header>

      <main className="mx-auto max-w-3xl p-4 space-y-6">
        {isLoading && <p className="text-center text-gray-400 py-12">Loading…</p>}

        {data && (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                label="Total Members"
                value={data.stats.total_members}
                color="bg-blue-50 text-blue-900"
              />
              <StatCard
                label="Active This Week"
                value={data.stats.active_members}
                color="bg-green-50 text-green-900"
              />
              <StatCard
                label="Needs Attention"
                value={data.stats.inactive_members}
                color={data.stats.inactive_members > 0 ? 'bg-amber-50 text-amber-900' : 'bg-gray-50 text-gray-700'}
              />
            </div>

            {/* Visit trend chart */}
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <h2 className="text-sm font-medium text-gray-600 mb-4">Visits — last 30 days</h2>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data.visit_trend}>
                  <defs>
                    <linearGradient id="visitGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    tick={{ fontSize: 11 }}
                    interval={6}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={24} />
                  <Tooltip
                    labelFormatter={formatDate}
                    formatter={(v: number) => [v, 'visits']}
                  />
                  <Area
                    type="monotone"
                    dataKey="visits"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#visitGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Needs attention */}
              <div className="rounded-xl bg-white p-4 shadow-sm">
                <h2 className="text-sm font-medium text-gray-600 mb-3">
                  Needs attention
                  <span className="ml-1.5 text-xs text-gray-400">(active membership, no visit in 14+ days)</span>
                </h2>
                {data.inactive.length === 0 ? (
                  <p className="text-sm text-gray-400">All active members are showing up regularly.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.inactive.map((m) => (
                      <li key={m.id} className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {m.full_name ?? m.email}
                          </p>
                          {m.full_name && (
                            <p className="text-xs text-gray-400">{m.email}</p>
                          )}
                        </div>
                        <span className="text-xs text-amber-600 whitespace-nowrap">
                          {daysSince(m.last_visit)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Top visitors */}
              <div className="rounded-xl bg-white p-4 shadow-sm">
                <h2 className="text-sm font-medium text-gray-600 mb-3">
                  Top visitors
                  <span className="ml-1.5 text-xs text-gray-400">(last 30 days)</span>
                </h2>
                {data.top_visitors.length === 0 ? (
                  <p className="text-sm text-gray-400">No visits recorded yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.top_visitors.map((m, i) => (
                      <li key={m.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                          <div>
                            <p className="text-sm font-medium text-gray-800">
                              {m.full_name ?? m.email}
                            </p>
                            {m.full_name && (
                              <p className="text-xs text-gray-400">{m.email}</p>
                            )}
                          </div>
                        </div>
                        <span className="text-xs font-medium text-blue-600 whitespace-nowrap">
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
    </div>
  );
}
