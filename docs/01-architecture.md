# Architecture

## High-level shape

```
┌─────────────┐      HTTPS / JWT      ┌──────────────┐      SQL      ┌──────────────┐
│   React     │ ─────────────────────▶│   Express    │──────────────▶│  PostgreSQL  │
│   (web)     │                       │   API        │               │              │
└─────────────┘                       └──────────────┘               └──────────────┘
```

Polling for live-ish updates in v1. WebSockets is a later concern.

## Repository layout

```
gym-system/
├── CLAUDE.md
├── docs/                       # all design docs
├── backend/
│   ├── src/
│   │   ├── modules/            # feature modules (one folder per domain)
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── gyms/
│   │   │   ├── memberships/
│   │   │   ├── checkins/
│   │   │   └── qr/
│   │   ├── middleware/         # auth, error handling, tenancy guard
│   │   ├── db/                 # connection, migrations, repository base
│   │   ├── lib/                # shared utilities (signing, validation)
│   │   ├── config/             # env loading, constants
│   │   └── server.ts           # entry point
│   ├── migrations/
│   ├── tests/
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/              # route-level components
│   │   ├── features/           # feature modules (mirror backend modules)
│   │   ├── components/         # shared UI primitives
│   │   ├── lib/                # api client, hooks, utilities
│   │   ├── routes.tsx
│   │   └── main.tsx
│   └── package.json
└── README.md
```

## Module structure (backend)

Every backend module follows the same shape:

```
modules/checkins/
├── checkins.controller.ts      # HTTP layer — parse, validate, format
├── checkins.service.ts         # business logic — the only place rules live
├── checkins.repository.ts      # database access — the only place SQL lives
├── checkins.routes.ts          # route definitions, applies middleware
├── checkins.types.ts           # request/response/domain types
└── checkins.test.ts
```

**Why this shape**: separating controller / service / repository keeps tests easy (mock the repo, test the service), keeps the database swappable, and keeps HTTP concerns out of business logic. It also makes tenancy enforcement obvious — every repository method takes `gymId` explicitly.

## Layer responsibilities

| Layer | Does | Doesn't |
|-------|------|---------|
| Controller | Parse request, validate input shape, call service, format response | Contain business rules, touch the database |
| Service | Enforce business rules, orchestrate repositories, throw domain errors | Know about HTTP, format responses |
| Repository | Run SQL, map rows to domain objects | Make decisions, throw HTTP errors |

## Module structure (frontend)

```
features/checkins/
├── api.ts                      # fetch calls to /api/checkins/*
├── hooks.ts                    # useCheckins, useLastVisit, etc.
├── components/                 # CheckinButton, CheckinHistory
└── types.ts
```

Pages compose features. Features don't import from other features — if they need to, the shared piece moves to `components/` or `lib/`.

## Naming

- Files: `kebab-case.ts`
- Types/Interfaces: `PascalCase`
- Functions/variables: `camelCase`
- Database tables: `snake_case`, plural (`users`, `user_gyms`, `check_ins`)
- Database columns: `snake_case`
- API routes: `kebab-case`, plural resource names (`/api/check-ins`)

## Environment

- `.env` for local dev, never committed
- `.env.example` committed with all required keys, no values
- Config loading is centralized — no `process.env.X` outside `config/`

## Errors

Define a small set of typed domain errors:

- `NotFoundError`
- `UnauthorizedError`
- `ForbiddenError` (for tenancy violations specifically — different from 401)
- `ValidationError`
- `ConflictError` (e.g. already joined gym)

The error-handling middleware maps these to HTTP codes. Services throw them; controllers don't construct them.

## Testing strategy

- Unit tests on services (mock repositories)
- Integration tests on routes (real test database, in-memory or docker)
- No frontend tests in v1 unless something gets gnarly — manual testing is fine for now
