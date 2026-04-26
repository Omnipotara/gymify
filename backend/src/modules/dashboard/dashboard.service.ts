import * as repo from './dashboard.repository';
import type { DashboardResponse } from './dashboard.types';

export async function getDashboard(gymId: string): Promise<DashboardResponse> {
  const [stats, inactive, top_visitors, visit_trend] = await Promise.all([
    repo.getStats(gymId),
    repo.getInactiveMembers(gymId),
    repo.getTopVisitors(gymId),
    repo.getVisitTrend(gymId),
  ]);
  return { stats, inactive, top_visitors, visit_trend };
}
