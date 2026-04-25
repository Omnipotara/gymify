# Data Model

> Every gym-scoped table includes `gym_id`. Every gym-scoped query MUST filter by it. This is the single most important rule in the system.

## Tables

### `users`

The single account table. One row per human, regardless of role.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `email` | TEXT UNIQUE NOT NULL | lowercased on write |
| `password_hash` | TEXT NOT NULL | bcrypt or argon2 |
| `full_name` | TEXT | |
| `is_super_admin` | BOOLEAN NOT NULL DEFAULT false | platform-level role only |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | |

**Why no `role` column here**: role is per-gym, not global. A user might be admin at Gym A and member at Gym B. The only global role is `is_super_admin`, which is a platform concept (creates gyms), not a gym-scoped role.

---

### `gyms`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `name` | TEXT NOT NULL | |
| `slug` | TEXT UNIQUE | URL-safe identifier, optional |
| `join_qr_secret` | TEXT NOT NULL | random secret used to sign the join QR |
| `checkin_qr_secret` | TEXT NOT NULL | separate secret for check-in QR |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | |
| `created_by` | UUID REFERENCES users(id) | the super-admin who created it |

**Why two secrets**: rotating one without invalidating the other. Compromising the join QR shouldn't let an attacker forge check-ins, and vice versa.

---

### `user_gyms`

The many-to-many join. Carries the per-gym role.

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE | |
| `gym_id` | UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE | |
| `role` | TEXT NOT NULL CHECK (role IN ('member', 'admin')) | |
| `joined_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | |
| PRIMARY KEY | `(user_id, gym_id)` | one role per gym per user |

**Why role is here, not on users**: see overview decision #3. A gym owner can be a member of another gym, and that has to be representable.

**Indexes**: `(gym_id)` for "list all members of this gym", `(user_id)` for "list all gyms this user belongs to".

---

### `memberships`

Tracks paid membership periods. Status is computed, not stored.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `user_id` | UUID NOT NULL REFERENCES users(id) | |
| `gym_id` | UUID NOT NULL REFERENCES gyms(id) | |
| `start_date` | DATE NOT NULL | |
| `end_date` | DATE NOT NULL | |
| `created_by` | UUID REFERENCES users(id) | the admin who created/extended it |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | |

**Status is derived**: `active` if today is between start and end, `expiring_soon` if end is within N days, `expired` if past end. Computed in the service layer or as a SQL view — never stored, because it would go stale and require cron jobs to maintain.

**Multiple memberships per user per gym is allowed** — represents history. The "current" membership is the one whose date range contains today, or the most recently ended one if none is active.

**Indexes**: `(user_id, gym_id, end_date DESC)` for "find current membership".

---

### `check_ins`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `user_id` | UUID NOT NULL REFERENCES users(id) | |
| `gym_id` | UUID NOT NULL REFERENCES gyms(id) | |
| `checked_in_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | |

**No `check_out` column** — gyms don't reliably scan on exit, and it's not needed for the retention thesis. Visit count and last-visit are what matter.

**Duplicate prevention**: enforced in the service layer, not the DB. Rule: same `user_id` + `gym_id` within the last N minutes (default 30) → reject as duplicate. Don't put this as a unique constraint because the cutoff window is a business rule, not a data invariant.

**Indexes**: `(gym_id, checked_in_at DESC)` for dashboard queries, `(user_id, gym_id, checked_in_at DESC)` for personal history.

---

### `rewards` (deferred to Slice 4)

Schema TBD. Mentioned in spec but not designed yet — will be defined when Slice 4 starts. Don't create the table during Slices 1–3.

## Relationships at a glance

```
users ──┐
        ├──< user_gyms >── gyms
        │                    │
        ├────< memberships >─┤
        │                    │
        └────< check_ins >───┘
```

A user touches a gym through three different relationships:
- **Membership** in the org (`user_gyms` — exists from join time forever)
- **Paid period** (`memberships` — bounded by dates, can have many)
- **Visit history** (`check_ins` — append-only event log)

These are deliberately separate. Joining a gym ≠ having an active membership ≠ having visited recently. The dashboard cares about the difference.

## Migrations

Use a real migration tool (`node-pg-migrate`, Prisma migrate, Knex). No "auto-sync from models" — explicit migrations only. Migration files are committed.

## Seed data

A seed script should create:
- One super-admin (credentials from env)
- One demo gym
- One admin user attached to that gym
- A handful of member users
- A few check-ins spread over the past week

This makes Slice 1 testable without manual DB poking.
