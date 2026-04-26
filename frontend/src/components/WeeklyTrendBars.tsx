import type { WeeklyVisit } from '../features/memberships/types';

const WEEK_LABELS = ['This week', 'Last week', '2 wks ago', '3 wks ago'];

export function WeeklyTrendBars({ trend }: { trend: WeeklyVisit[] }) {
  const max = Math.max(...trend.map((w) => w.visits), 1);
  const ordered = [...trend].reverse();
  return (
    <div className="flex items-end gap-1.5 h-10">
      {ordered.map((w) => {
        const label = WEEK_LABELS[3 - w.week_offset];
        const pct = (w.visits / max) * 100;
        return (
          <div key={w.week_offset} className="flex flex-col items-center gap-0.5 flex-1">
            <span className="text-xs font-medium text-gray-600">{w.visits}</span>
            <div
              className="w-full rounded-t-sm bg-blue-400"
              style={{ height: `${Math.max(pct * 0.28, w.visits > 0 ? 4 : 1)}px` }}
            />
            <span className="text-[10px] text-gray-400 text-center leading-tight whitespace-nowrap">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
