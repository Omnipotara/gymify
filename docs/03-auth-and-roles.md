# Auth and Roles

## Single account model

One `users` table. One login form. One JWT issued per session. The "two entry points" the marketing site shows ("Login as business" / "Login as user") both submit to the same `/api/auth/login` endpoint — the framing is purely UX.

## Roles

Three role concepts, two scopes:

| Role | Scope | Storage |
|------|-------|---------|
| `super_admin` | Global / platform | `users.is_super_admin` boolean |
| `admin` | Per gym | `user_gyms.role = 'admin'` |
| `member` | Per gym | `user_gyms.role = 'member'` |

A single human can be:
- A super-admin (rare — platform staff)
- An admin at one gym, member at another (gym owner who works out elsewhere)
- A member at multiple gyms (the common case)
- Both admin and member at the same gym (a gym owner who also works out at their own gym — handled by giving them `admin` role; admins implicitly have member privileges at their own gym)

## Auth flow

### Registration
- `POST /api/auth/register` with `{ email, password, full_name }`
- Creates a `users` row
- Returns a JWT
- A new user has no `user_gyms` rows — they're not in any gym yet. They join by scanning a QR.

### Login
- `POST /api/auth/login` with `{ email, password }`
- Returns a JWT and a basic user profile

### JWT payload

```json
{
  "sub": "<user_id>",
  "email": "<email>",
  "is_super_admin": false,
  "iat": ...,
  "exp": ...
}
```

**What's NOT in the JWT**: per-gym roles. They live in the database and are checked on every gym-scoped request via the tenancy middleware. Including them in the JWT would make role changes (admin promoting/demoting users) require token re-issue, which is fragile.

### Token lifetime
- Access token: short (e.g. 1 hour)
- Refresh token: longer (e.g. 30 days), stored httpOnly cookie or as a separate token returned to the client
- Slice 1 can ship with just access tokens; refresh flow can come in Slice 2

## Per-request authorization

Every protected route runs through middleware in this order:

1. **`requireAuth`** — verifies the JWT, attaches `req.user = { id, email, is_super_admin }`. 401 on failure.
2. **`requireGymMembership(role?)`** — for gym-scoped routes. Looks up `user_gyms` for `(req.user.id, req.params.gymId)`. Attaches `req.gymRole`. If a `role` argument is passed (e.g. `'admin'`), checks the user has at least that level. 403 on failure.
3. **`requireSuperAdmin`** — for platform routes only. Checks `req.user.is_super_admin`. 403 on failure.

This keeps the auth story explicit at the route level: you can read a `routes.ts` file and immediately see what's protected and how.

## How the UI picks a "view"

After login, the frontend fetches `GET /api/me/gyms`, which returns the user's gym list with their role at each:

```json
{
  "user": { "id": "...", "email": "...", "is_super_admin": false },
  "gyms": [
    { "id": "...", "name": "Aca Gym", "role": "member" },
    { "id": "...", "name": "Poznanovic Gym", "role": "admin" }
  ]
}
```

The frontend uses this to decide:
- If the user has any `admin` role → show a view switcher in the nav
- If the user has *only* `admin` roles (no member memberships) → default to admin view
- If the user is super-admin → also show a "platform" view
- Otherwise → member view

The user explicitly picks which gym they're operating in (via a gym selector). The selected `gymId` becomes part of all subsequent gym-scoped requests.

## Tenancy enforcement (the critical part)

Two layers of defense, both required:

1. **Route middleware** (`requireGymMembership`) blocks unauthorized users from gym-scoped endpoints.
2. **Repository layer** always includes `gym_id` in WHERE clauses. Even if middleware is misconfigured, a repo function called with the wrong gym_id returns nothing.

Pattern: every repository method that touches gym-scoped data takes `gymId` as an explicit argument. There is no "global find" function that omits it.

```ts
// good
findCheckInsForUser(gymId: string, userId: string)

// banned
findCheckInsForUser(userId: string)  // would leak across gyms
```

## Password handling

- Hash with argon2id (preferred) or bcrypt
- Never log password fields, even at debug level
- Password reset flow: deferred to Slice 2, not needed for Slice 1

## Rate limiting

- Login: 5 attempts per IP per minute
- Registration: 3 per IP per minute
- QR scans (join + checkin): 10 per user per minute — generous, but stops abuse

Implement with `express-rate-limit` or similar. Slice 1 minimum: login + register.
