# Backend — Working Notes

> Loaded automatically when working inside `backend/`.

## Stack specifics

- Node.js (LTS), TypeScript
- Express for HTTP
- PostgreSQL via `pg` driver directly, OR a thin query builder (Kysely / Knex). **Do not use Prisma or TypeORM** — they hide query construction, and tenancy bugs hide best where queries are invisible.
- Zod for request validation
- argon2 for password hashing
- jsonwebtoken for JWTs
- qrcode (for image generation) and a small custom HMAC signer for QR payloads
- express-rate-limit
- helmet
- pino for logging

## Module shape

Every module under `src/modules/` has the same files: `*.controller.ts`, `*.service.ts`, `*.repository.ts`, `*.routes.ts`, `*.types.ts`, `*.test.ts`. See `docs/01-architecture.md` for layer responsibilities.

## Tenancy lint rule

Every repository function whose table has a `gym_id` column MUST take `gymId: string` as the first argument and include it in the WHERE clause. Code review catches this; consider an ESLint rule later.

## Tests

- Vitest or Jest, your call — pick one and stick with it
- Services tested with mocked repositories
- Routes tested against a real Postgres test database (`pg-mem` is too limited)
- Test database setup/teardown per file via transactions or truncation

## Migrations

Use `node-pg-migrate` or Knex migrations. Migrations are committed; never auto-sync from code.

## Don't

- Don't import from `controllers/` into `services/` (services don't know about HTTP)
- Don't import from `repositories/` into `controllers/` (controllers go through services)
- Don't put business logic in middleware
- Don't write SQL outside repositories
