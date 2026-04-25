# Gym Management System — Working Context

> This file is loaded automatically every session. Keep it tight. Detailed docs live in `docs/`.

## What this is

A multi-tenant gym management system focused on **member retention**. Gym owners use it to track attendance, spot inactivity early, and reduce churn. Members use it to join gyms (via QR), check in, and see their membership status.

## What this is NOT

Do not drift into:
- Workout planning or fitness tracking
- Social features (feeds, friends, comments)
- Payment processing (memberships are admin-managed manually)
- A generic CRUD app — every feature should serve retention or attendance

## Current slice

**🚧 Currently building: Slice 1 — Join a gym + check in**

See `docs/slices/slice-1-join-and-checkin.md` for scope. Do not build features from later slices unless explicitly asked.

## Stack

- **Backend**: Node.js (Express), PostgreSQL
- **Frontend**: React (web first; PWA/Electron later — do not design for them yet)
- **Realtime**: polling for v1, WebSockets only if needed later
- **Auth**: JWT, single-account system with per-gym roles

## Hard rules (non-negotiable)

1. **Tenancy isolation**: every query touching gym-scoped data MUST filter by `gym_id`. No exceptions. A user's membership at Gym A must never leak into Gym B.
2. **Single account system**: one `Users` table. Roles (`member`, `admin`) live on the `UserGyms` join table, per gym. Super-admin is the one global role.
3. **QR scans validate server-side**. The QR carries `gym_id` + signed token. The user's session is what proves identity, not the QR.
4. **No ORM magic that hides queries**. If we use an ORM, queries must remain inspectable. Tenancy bugs are the #1 risk in this app.

## Where to find what

| Need | File |
|------|------|
| Product vision, locked decisions | `docs/00-overview.md` |
| Folder structure, conventions | `docs/01-architecture.md` |
| Database schema | `docs/02-data-model.md` |
| Auth, roles, login UX | `docs/03-auth-and-roles.md` |
| QR system (join + check-in) | `docs/04-qr-system.md` |
| API request/response shape | `docs/05-api-conventions.md` |
| Tenancy & security rules | `docs/06-security.md` |
| Current slice scope | `docs/slices/slice-1-join-and-checkin.md` |
| Decision log | `docs/decisions.md` |

## Coding conventions

- Business logic in service layer, not controllers
- Controllers handle HTTP only (parse, validate, call service, format response)
- Database access through a repository layer — no raw queries in services
- All gym-scoped service functions take `gymId` as the first argument after the user context
- Errors throw typed errors; controller layer maps them to HTTP codes
- No `any` types if we use TypeScript; if plain JS, use JSDoc on public functions

## Working style

- Ask before introducing new dependencies
- Prefer small, focused PRs that complete one slice item
- When in doubt about scope, check the current slice doc and ask
- Update `docs/decisions.md` when making non-obvious choices
