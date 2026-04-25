# Slice 1: Join a gym + check in

## Goal

A new user can:
1. Register an account
2. Log in
3. Scan a join QR to link their account to a gym
4. Scan a check-in QR to log a visit
5. See their list of gyms and their check-in history at each one

That's it. No admin features, no membership management, no dashboards, no analytics.

## Why this slice first

It exercises every piece of the architecture end-to-end: auth, the QR pipeline, the multi-tenant data model, and the React frontend talking to the API. If any architectural assumption is wrong, we find out before we've built three features on top of it.

## In scope

### Backend
- [ ] Database setup, migrations, seed script
- [ ] `POST /api/auth/register`
- [ ] `POST /api/auth/login`
- [ ] `GET /api/me` — current user info
- [ ] `GET /api/me/gyms` — list of gyms the user belongs to (with role)
- [ ] `POST /api/gyms/join` — scan join QR
- [ ] `POST /api/gyms/:gymId/check-ins` — scan check-in QR
- [ ] `GET /api/gyms/:gymId/me/check-ins` — my check-in history at this gym
- [ ] QR validation library (verify HMAC signatures, type matching)
- [ ] Auth middleware (`requireAuth`, `requireGymMembership`)
- [ ] Rate limiting on auth and QR endpoints
- [ ] Tenancy guard at the repository layer (every gym-scoped query takes `gymId`)
- [ ] Seed script: 1 super-admin, 1 gym, 1 admin user, 3 member users, a few check-ins

### Frontend
- [ ] Register page
- [ ] Login page (single form, no role selector)
- [ ] After-login landing: gym list (uses `GET /api/me/gyms`)
- [ ] "Add gym" flow: scan QR → call join API → see new gym appear
- [ ] Per-gym page showing: gym name, my recent check-ins
- [ ] "Check in" button on the per-gym page that opens the camera and scans the check-in QR
- [ ] Logout
- [ ] Basic styling — does not need to be polished

### Tooling / infra
- [ ] Backend project initialized (Node + Express + TS)
- [ ] Frontend project initialized (Vite + React + TS)
- [ ] PostgreSQL running locally (Docker Compose preferred)
- [ ] `.env.example` with all required keys
- [ ] README with "how to run locally"

## Out of scope (do NOT build in this slice)

- Admin dashboard
- Member list view (admin-side)
- Membership creation / extension
- Membership status display ("expiring soon", etc.)
- Visit analytics, weekly counts, streaks
- Loyalty / rewards
- At-risk detection
- Refresh tokens / session refresh
- Password reset
- 2FA
- Email verification
- Profile editing
- QR generation / regeneration UI (the seed script can hardcode the secrets — we'll generate QRs manually for testing in Slice 1)
- Super-admin UI (super-admin actions can be done via DB / seed script for now)

## Acceptance criteria

A reviewer can clone the repo, run `docker compose up` + `npm run dev` in both `backend` and `frontend`, and:

1. Register a new account at `localhost:5173`
2. Log in
3. Click "Add gym", scan the seed gym's join QR (printed from the seed script output, or visible in admin tooling)
4. See the gym appear in their list
5. Open the gym, click "Check in", scan the check-in QR
6. See the check-in appear in their history
7. Log out, log back in, all data persists

And:

8. A second user can register and join the same gym independently — their check-ins don't appear on the first user's page (tenancy proven)
9. A user cannot scan a join QR as a check-in QR or vice versa (returns 400)
10. A user cannot view check-ins for a gym they haven't joined (returns 404)

## Build order (suggested)

1. Project scaffolding (backend + frontend + Postgres)
2. Database migrations for `users`, `gyms`, `user_gyms`, `check_ins`
3. Seed script
4. Register + login + JWT middleware
5. `GET /api/me` and `GET /api/me/gyms`
6. Frontend: register/login pages + post-login gym list
7. QR validation library (unit tested)
8. `POST /api/gyms/join`
9. Frontend: "Add gym" flow with QR scanner
10. `POST /api/gyms/:gymId/check-ins` + history endpoint
11. Frontend: per-gym page + check-in flow
12. End-to-end manual test against acceptance criteria

## Notes

- `memberships` table can be created during this slice (the migration is cheap), but it's not used yet
- The 30-minute check-in dedup window is in scope — implement it now so we don't have duplicate-check-in bugs to fix later
- For QR scanning on the frontend, use a maintained library like `html5-qrcode` or `@yudiel/react-qr-scanner`
