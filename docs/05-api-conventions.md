# API Conventions

## Base URL

All routes are prefixed with `/api`. No versioning in v1 — when we need v2 we'll add `/api/v2`.

## How `gymId` flows through the system

`gymId` is **always in the URL path** for gym-scoped routes, never in headers or JWT claims. This makes routes self-documenting and middleware composition obvious.

```
/api/gyms/:gymId/members
/api/gyms/:gymId/check-ins
/api/gyms/:gymId/memberships
```

User-scoped routes (a user across all their gyms) live under `/api/me`:

```
/api/me/gyms              # list all gyms I belong to
/api/me/check-ins         # my check-in history across all gyms
```

Platform routes (super-admin only) live under `/api/platform`:

```
/api/platform/gyms        # create / list all gyms
```

## Response shape

### Success
Return the resource directly, or an envelope for collections:

```json
// single resource
{ "id": "...", "name": "Aca Gym", ... }

// collection
{ "items": [...], "total": 42 }
```

No success/data wrapping (`{ "success": true, "data": ... }`) — HTTP status codes carry that information.

### Error

Consistent shape, always:

```json
{
  "error": {
    "code": "MEMBERSHIP_NOT_FOUND",
    "message": "No active membership for this user at this gym"
  }
}
```

`code` is a stable machine-readable string; `message` is for humans. Frontend should switch on `code`, never on `message`.

## HTTP status codes

| Code | When |
|------|------|
| 200 | Success with body |
| 201 | Resource created |
| 204 | Success, no body |
| 400 | Malformed request, validation failure, bad QR signature |
| 401 | Missing or invalid JWT |
| 403 | Authenticated but not allowed (tenancy violation, wrong role) |
| 404 | Resource doesn't exist *or* user can't see it (don't leak existence) |
| 409 | Conflict (e.g. already joined gym, duplicate check-in) |
| 429 | Rate limit hit |
| 500 | Unexpected server error |

**Note on 403 vs 404**: prefer 404 for "this gym exists but you're not a member of it" — telling the user "you're not allowed" leaks that the gym exists. Use 403 only when the user clearly should know they were denied (e.g. they're a member but trying to access an admin endpoint).

## Validation

- Use a schema library (Zod, Joi, or similar)
- Validate at the controller boundary, not in services
- Validation errors return 400 with `code: "VALIDATION_ERROR"` and a `details` field listing problems

## Pagination

Cursor-based for anything that can grow (check-ins, members):

```
GET /api/gyms/:gymId/check-ins?limit=50&before=<iso_timestamp>
```

Returns:
```json
{
  "items": [...],
  "next_cursor": "<iso_timestamp>"
}
```

Page-based pagination is fine for short lists (members of a gym, gyms a user belongs to) — those won't paginate often in v1.

## Dates and times

- Wire format: ISO 8601 with timezone (`2026-04-25T14:30:00Z`)
- Database: `TIMESTAMPTZ` for timestamps, `DATE` for date-only fields like membership start/end
- Never send naive datetimes to or from the client

## ID format

UUIDs everywhere, generated server-side. No auto-increment integers exposed in URLs.

## Idempotency

- Joining a gym is idempotent — scanning the same join QR twice should not error
- Check-ins are not idempotent — but the server-side dedup window (30 min) prevents accidental double-scans

## Example endpoints (for reference)

```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/me
GET    /api/me/gyms

POST   /api/gyms/join                                    # body: signed join QR payload
POST   /api/gyms/:gymId/check-ins                        # body: signed check-in QR payload
GET    /api/gyms/:gymId                                  # gym info, requires membership
GET    /api/gyms/:gymId/me/check-ins                     # my history at this gym
GET    /api/gyms/:gymId/me/membership                    # my current membership

# admin-only (require admin role for the gym)
GET    /api/gyms/:gymId/members
GET    /api/gyms/:gymId/check-ins
POST   /api/gyms/:gymId/memberships                      # extend a member's membership

# super-admin only
POST   /api/platform/gyms
GET    /api/platform/gyms
```

Slice 1 only needs a subset of these — see the slice doc for exact scope.
