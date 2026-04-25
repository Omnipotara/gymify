# QR System

## Two QR types

The system uses **two distinct, non-interchangeable** QR codes per gym.

| Type | Purpose | Where it lives | Frequency |
|------|---------|----------------|-----------|
| **Join QR** | Links a user account to a gym | Given out by gym staff (printed flyer, onboarding page) | Scanned once per user per gym |
| **Check-in QR** | Logs a visit | Posted at gym entrance | Scanned every visit |

A check-in QR must never authenticate as a join QR, and vice versa. Enforced by including the QR type in the signed payload.

## Payload format

Both QRs carry a JSON-ish payload (encoded as a URL or compact string), signed with HMAC-SHA256 using the gym's secret.

### Join QR

```
{
  "v": 1,
  "type": "join",
  "gym_id": "<uuid>",
  "sig": "<hmac>"
}
```

Signed with `gyms.join_qr_secret`.

### Check-in QR

```
{
  "v": 1,
  "type": "checkin",
  "gym_id": "<uuid>",
  "sig": "<hmac>"
}
```

Signed with `gyms.checkin_qr_secret`.

The signature covers `v + type + gym_id`. Different secret per type means the signatures aren't interchangeable.

## Why static, not rotating

Decided trade-off (see overview decision #1): static QRs are pragmatic. They live on a wall or printed page, no display hardware needed. The security comes from the **authenticated session** required to scan them, not from the QR itself.

A photographed check-in QR is useless without the member's logged-in account. The gym admin can also verify members are physically present (visual check at the door).

## Scan flows

### Join flow

1. User opens the app, taps "Add gym", scans the join QR
2. Frontend extracts `{ gym_id, type, sig }` from the QR
3. Frontend calls `POST /api/gyms/join` with the payload + the user's JWT
4. Backend:
   - Verifies the JWT (auth middleware)
   - Looks up the gym by `gym_id`
   - Verifies the signature with the gym's `join_qr_secret`
   - Checks `type === "join"` — reject if it's a check-in QR
   - Checks the user isn't already in `user_gyms` for this gym (return success idempotently if they are)
   - Inserts a `user_gyms` row with `role = 'member'`
   - Returns the gym info
5. Frontend adds the gym to the user's gym list

### Check-in flow

1. User taps "Check in" in the app, scans the check-in QR at the entrance
2. Frontend extracts payload, calls `POST /api/check-ins` with it
3. Backend:
   - Verifies JWT
   - Verifies signature with `checkin_qr_secret`
   - Checks `type === "checkin"`
   - Verifies `(user_id, gym_id)` exists in `user_gyms`
   - Verifies the user has an active membership for that gym (or allow-but-flag, depending on Slice 2 rules)
   - Checks no recent check-in within the dedup window (default 30 min)
   - Inserts a `check_ins` row
   - Returns the check-in record + a friendly confirmation
4. Frontend shows "✅ Checked in at <gym name>"

## Validation rules (server-side, every scan)

The QR validation function — used by both endpoints — performs in this order:

1. Parse the payload, reject malformed
2. Look up the gym by `gym_id`, reject if not found
3. Recompute HMAC using the appropriate secret for the QR type
4. Constant-time compare with the provided signature, reject mismatch
5. Verify `type` field matches the expected type for the endpoint
6. Return verified `{ gym_id }`

If any step fails, return a generic 400 — don't leak which step failed (that's a security smell).

## Generating the QRs

A super-admin or gym admin can generate/regenerate the QR images:
- `POST /api/gyms/:gymId/qr/join/regenerate` — rotates `join_qr_secret`, returns new QR image
- `POST /api/gyms/:gymId/qr/checkin/regenerate` — rotates `checkin_qr_secret`, returns new QR image
- `GET /api/gyms/:gymId/qr/join` — returns the current join QR image (PNG or SVG)
- `GET /api/gyms/:gymId/qr/checkin` — returns the current check-in QR image

QR images are generated on-demand from the current secret, not stored. Use a library like `qrcode` (npm).

**Rotating a secret invalidates all existing printed QRs for that type.** This is a feature — if a check-in QR gets photographed and abused, the admin rotates and reprints.

## Out of scope for v1

- Time-limited or one-time-use QRs (would require server-rendered displays at gym entrances)
- Multi-gym franchise QRs
- Encrypted payloads (signing is sufficient — no secrets in the payload)
