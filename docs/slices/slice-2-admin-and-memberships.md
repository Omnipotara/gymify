# Slice 2: Admin views + manual membership management

> Detailed scope to be filled in after Slice 1 ships. High-level placeholder below.

## Goal

A gym admin can log in, see a list of members at their gym, and manually create or extend memberships.

## Likely scope

- Admin-side views (gated by `requireGymMembership('admin')`)
- `GET /api/gyms/:gymId/members`
- `POST /api/gyms/:gymId/memberships` — create/extend membership for a user
- Membership status calculation (`active`, `expiring_soon`, `expired`)
- Member's view of their own membership status
- Admin search / filter on members
- View switcher in UI for users with admin role

## Likely out of scope

- Analytics / dashboards (Slice 3)
- Loyalty (Slice 4)
- Payment integration (deferred indefinitely)

## Open questions to resolve before starting

- How long should an admin be able to backdate / edit a past membership?
- Should "expiring soon" threshold be configurable per gym, or a global constant?
- Do admins manage their own gym list, or is that super-admin only?
