export interface DashboardStats {
  total_members: number;
  active_members: number;
  inactive_members: number;
}

export interface InactiveMember {
  id: string;
  full_name: string | null;
  email: string;
  last_visit: string | null;
}

export interface TopVisitor {
  id: string;
  full_name: string | null;
  email: string;
  visit_count: number;
}

export interface VisitTrendPoint {
  date: string;
  visits: number;
}

export interface DashboardResponse {
  stats: DashboardStats;
  inactive: InactiveMember[];
  top_visitors: TopVisitor[];
  visit_trend: VisitTrendPoint[];
}
