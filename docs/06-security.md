# Security

## The #1 risk: tenancy leaks

The single most likely catastrophic bug in this system is a query that forgets to filter by `gym_id` and accidentally returns another gym's data. Everything below is in service of preventing that.

## Tenancy enforcement (defense in depth)

Three independent layers. All three must be in place — any one alone is insufficient.

### Layer 1: Route middleware

Every gym-scoped route runs `requireGymMembership` before its handler. The middleware:
- Reads `gymId` from the URL params
- Looks up `(req.user.id, gymId)` in `user_gyms`
- Attaches `req.gymRole` if found
- Returns 404 if not found (don't leak gym existence)
- Optionally checks role level if the route demands admin

### Layer 2: Repository signatures

Every gym-scoped repository function takes `gymId` as an explicit, required argument. There are no global "find by user" or "find by id" functions for gym-scoped entities.

```ts
// good — gymId is required, can't be forgotten
findCheckInsByUser(gymId: string, userId: string): Promise<CheckIn[]>

// banned — would silently leak across gyms
findCheckInsByUser(userId: string): Promise<CheckIn[]>
```

This is enforced by code review and a lint rule (TBD).

### Layer 3: Query construction

Every SQL statement in a repository touching a gym-scoped table includes `gym_id = $1` in the WHERE clause. This is the last line of defense if both layers above fail.

```sql
-- good
SELECT * FROM check_ins WHERE gym_id = $1 AND user_id = $2

-- banned
SELECT * FROM check_ins WHERE user_id = $1
```

## Auth specifics

### Password storage
- argon2id (preferred) with default Node bindings, or bcrypt with cost ≥ 12
- Never log passwords, even at debug level — sanitize request logging middleware
- No password requirements beyond "minimum 8 characters" in v1 (don't impose annoying complexity rules; length is what matters)

### JWT
- Sign with HS256 and a long random secret from env (`JWT_SECRET`, ≥ 32 bytes)
- Short access-token lifetime (1 hour for v1)
- Refresh tokens come in Slice 2

### Session storage on the client
- Access token stored in memory or `localStorage` for v1 (simpler)
- For Slice 2+, move to httpOnly refresh cookie + in-memory access token

## QR signature security

- HMAC-SHA256 with per-gym, per-type secrets stored in `gyms` table
- Secrets are random ≥ 32 bytes, generated at gym creation
- Signature comparison uses constant-time equality (`crypto.timingSafeEqual`)
- A failed signature returns a generic 400 — don't reveal whether the gym exists or whether the signature alone was bad

## Rate limiting

| Endpoint | Limit |
|----------|-------|
| `POST /api/auth/login` | 5 / IP / minute |
| `POST /api/auth/register` | 3 / IP / minute |
| `POST /api/gyms/join` | 10 / user / minute |
| `POST /api/gyms/:gymId/check-ins` | 10 / user / minute |
| All others | Generous default (e.g. 100 / user / minute) |

## Input validation

- All request bodies pass through a schema validator before reaching services
- Reject unknown fields (don't silently strip — fail loud during dev)
- Validate UUID format on path params
- Validate enum values on role/status fields

## Logging and PII

- Log request method, path, status, duration, user_id (if authed), gym_id (if scoped)
- Never log: passwords, JWT contents, full request bodies for auth endpoints, raw QR payloads
- Email is fine to log

## CORS

- Whitelist the frontend origin in env (`ALLOWED_ORIGIN`)
- `credentials: true` if using cookies
- Don't use `*` even in dev — set to `http://localhost:5173` or whatever Vite uses

## Helmet / headers

Use `helmet` middleware with defaults. The defaults are sane.

## SQL injection

Use parameterized queries always. If using a query builder or ORM, never interpolate user input into raw SQL strings.

## Things explicitly out of scope for v1

- 2FA / MFA (defer to Slice 2 or later)
- Audit logs (admin actions tracked in a separate table — Slice 2)
- Account lockout after N failed logins (rate limiting is the v1 stand-in)
- GDPR data export / deletion endpoints (defer)
- Encryption at rest beyond what Postgres gives by default
