# Slice 3: Attendance analytics + admin dashboard

> Detailed scope to be filled in after Slice 2 ships.

## Goal

Admins see a dashboard summarizing attendance patterns at their gym: who's active, who's slipping, who's gone. The retention thesis pays off here.

## Likely scope

- `GET /api/gyms/:gymId/dashboard` — aggregated stats
- Active members count (visited in last N days)
- Inactive members list (no visits in M days but membership still valid)
- Most active users (sorted by visits in last 30 days)
- Per-member visit history with frequency stats
- Visual charts (visits over time)

## Likely out of scope

- At-risk classification (still deferred — needs real data first)
- Predictive churn modeling
- Email notifications / nudges

## Open questions

- Define "active" threshold (visits per week? days since last visit?)
- Define "inactive" threshold
- Should aggregations be computed live or pre-computed? (depends on member count per gym)
