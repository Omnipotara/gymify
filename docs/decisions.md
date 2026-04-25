# Decision Log

A running list of non-obvious decisions and the reasoning behind them. New entries go on top. When in doubt, check here before re-debating something.

---

## 2026-04-26 — Check-in hard-gated behind active membership (Slice 2)
**Decision**: If a member has no active membership, the check-in endpoint returns an error. No "allow but flag" soft mode.
**Why**: A soft gate adds complexity (what does "flagged" mean? who sees it?) with no clear payoff. Hard gate is simple and honest — if you haven't paid, you can't check in.
**Alternative considered**: Allow check-in but mark it as unverified. Rejected — ambiguous semantics, deferred the problem rather than solving it.

---

## 2026-04-26 — "Expiring soon" threshold is 3 days
**Decision**: A membership is `expiring_soon` if `end_date` is within 3 days from today. Computed in the service layer, never stored.
**Why**: 3 days gives the member enough notice to renew without being annoying weeks in advance. Not configurable per gym in v1 — a global constant is simpler and can be made configurable later if gyms ask for it.
**Alternative considered**: 7 or 14 days. Rejected as too early — creates alert fatigue.

---

## 2026-04-26 — Admins can backdate memberships
**Decision**: The `start_date` on a membership can be set to any past date. No lower bound enforced.
**Why**: Members often pay at the counter before the admin has time to enter it. Backdating lets the record reflect reality — if someone paid on the 20th, their membership starts on the 20th.
**Alternative considered**: Force start_date >= today. Rejected — penalises members for admin delays.

---

## 2026-04-25 — Build in vertical slices, not horizontal layers
**Decision**: Ship Slice 1 (auth + join + check-in) end-to-end before starting Slice 2.
**Why**: Each slice is demonstrable, exercises the full stack, and surfaces integration issues early.
**Alternative considered**: Build all backend, then all frontend. Rejected — slow to validate, easy to over-build the backend.

---

## 2026-04-25 — Drop at-risk detection from v1
**Decision**: No at-risk classification in the initial build, but log all check-ins with timestamps so the feature can be added later without backfill.
**Why**: Defining "at-risk" well requires real data and iteration. Shipping a bad heuristic is worse than shipping none.
**Alternative considered**: Hardcoded threshold ("no visit in 14 days = at-risk"). Rejected as too crude to be useful.

---

## 2026-04-25 — Single account system, not separate business/user logins
**Decision**: One `users` table, one login form. Per-gym roles live on `user_gyms`. Marketing site can show "Login as business" / "Login as user" as two buttons that submit to the same endpoint.
**Why**: A gym owner is also a person. They may work out at their own gym, a competitor's gym, or own multiple gyms. Two separate auth systems force them into duplicate accounts.
**Alternative considered**: Separate `business_users` and `users` tables. Rejected — duplicates auth logic, breaks the multi-role-per-human use case.

---

## 2026-04-25 — Admin-managed memberships, no payment integration
**Decision**: Members pay at the counter. Admins manually extend memberships in the dashboard.
**Why**: Payment integration adds significant scope, compliance, and is unnecessary for the core retention thesis. Can be added later.
**Alternative considered**: Stripe integration from day one. Deferred.

---

## 2026-04-25 — Static QR + authenticated session for check-ins
**Decision**: QR posted on the wall is static and contains `gym_id` + signed token. Scans only count when made from a logged-in member's app session.
**Why**: Pure static QRs are spoofable by photograph. Rotating QRs need display hardware at every gym. Static-with-auth is the pragmatic middle.
**Alternatives considered**:
- Pure static QR (no auth) — rejected, too easy to spoof
- Rotating QR on a tablet — rejected, hardware burden too high for v1

---

## 2026-04-25 — Super-admin creates gyms (no self-serve)
**Decision**: Gym provisioning requires a platform-level super-admin. Self-serve gym signup is deferred.
**Why**: Self-serve raises verification, anti-fraud, and billing questions that don't need answers yet. Manual provisioning unblocks v1.
