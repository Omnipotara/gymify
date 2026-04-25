# Product Overview

## The product in one sentence

A multi-tenant system that helps gym owners retain members by tracking attendance behavior and surfacing churn risk early.

## Why this exists

Most gym management software focuses on billing, schedules, and class bookings. This one focuses on the single metric that actually predicts whether a member will quit: **how often they show up**. By logging every check-in and analyzing patterns over time, the system gives gym owners visibility they currently don't have — who's slipping, who's loyal, and who deserves a nudge.

## Two roles, one backend

- **Member** — joins gyms via QR, checks in on each visit, sees their own membership status and visit history.
- **Admin** — manages members at one or more gyms, extends memberships manually, sees attendance dashboards.
- **Super-admin** (platform level) — provisions gyms and assigns the first admin per gym.

A single human can hold any combination of these. Roles are stored per gym (on the `UserGyms` join table), not globally on the user.

## Multi-tenancy model

- One user can belong to many gyms.
- One gym has many users.
- Each gym's data (memberships, check-ins, analytics) is fully isolated.
- A QR code from one gym must never authenticate against another.

## The core loop

1. Member scans the gym's check-in QR on entry
2. System logs the visit (timestamp, gym_id, user_id)
3. Stats update (visit count, last visit, weekly frequency)
4. Behavior analysis flags trends (active, dropping off, inactive)
5. Admin sees insights on the dashboard

## Locked decisions (with rationale)

These were debated and settled. Do not re-litigate without explicit reason.

### 1. Check-in QR is static, but scans require an authenticated session
**Decision**: The QR posted on the gym wall is static and contains `gym_id` + signed token. A scan only counts if it comes from the member's logged-in app session, where the backend verifies the user belongs to that gym.

**Why**: A static QR alone (no auth) is trivially spoofable — anyone could photograph it and check in from home. Rotating QRs on a tablet are most secure but require hardware at every gym. Static-with-auth is the pragmatic middle: cheap, no extra hardware, and the auth requirement makes spoofing useless because you'd need the member's account anyway.

### 2. Memberships are admin-managed, no payment integration
**Decision**: Members pay at the counter. The admin clicks "extend membership" in the dashboard, picks a duration, and the new end date is saved. The member sees the update in their app.

**Why**: Payment integration (Stripe etc.) adds significant scope, compliance burden, and is unnecessary for the core retention thesis. Can be added later as an enhancement.

### 3. Single-account auth, not separate business/user logins
**Decision**: One `Users` table, one login form, one auth flow. Roles per gym live on `UserGyms`. The marketing site can present "Login as business" and "Login as user" as two buttons that point to the same form for clarity.

**Why**: A gym owner is also a person — they may work out at their own gym, a competitor's gym, or own multiple gyms. Two separate auth systems would force them into duplicate accounts for no functional gain. After login, the UI shows the appropriate view based on what gyms/roles the user has.

### 4. Super-admin creates gyms (for now)
**Decision**: Gym provisioning is done by a platform-level super-admin. Self-serve gym signup is out of scope for v1.

**Why**: Self-serve onboarding raises verification, anti-fraud, and billing questions that don't need answers yet. Manual provisioning lets us focus on the core product.

### 5. At-risk detection is dropped from v1
**Decision**: We will not implement at-risk classification in the initial build. However, we *will* log all check-in data with timestamps so the feature can be added later without backfilling.

**Why**: Defining "at-risk" well requires real data and iteration. Shipping a bad heuristic is worse than shipping none. The data foundation costs nothing extra to lay now.

### 6. Build in vertical slices, not horizontal layers
**Decision**: Build end-to-end functionality slice by slice (auth+join+checkin first, then admin+memberships, then analytics, then loyalty) instead of building all-of-backend then all-of-frontend.

**Why**: Each slice produces something demonstrable and testable. Catches integration issues early. Easier to course-correct if priorities shift.

## What this is NOT

Do not extend this system into:
- A workout planner or exercise tracker
- A class booking or scheduling system (yet — could come later, but not now)
- A social network with feeds, friends, or comments
- A general-purpose CRM

If a feature doesn't directly serve **membership management**, **attendance tracking**, or **retention analytics**, it doesn't belong in v1.
