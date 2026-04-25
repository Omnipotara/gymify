# Gymify

> A multi-tenant gym management system built around one metric: **are your members actually showing up?**

Most gym software focuses on billing and scheduling. Gymify focuses on the thing that predicts churn before it happens — attendance. Gym owners get a clear picture of who's slipping, who's loyal, and who deserves a nudge. Members get a frictionless check-in experience via QR code.

---

## Features

- **QR-based check-in** — members scan a code at the gym entrance. No app download required beyond a browser.
- **Join via QR** — new members link their account to a gym by scanning an onboarding QR, no manual admin step needed.
- **Multi-gym support** — one account works across multiple gyms. A gym owner can also be a member at a competitor's gym.
- **Role-based access** — members see their own history; admins see the whole gym's attendance.
- **Admin-managed memberships** — admins extend memberships manually; no payment processing complexity.
- **Retention analytics** *(coming in a later slice)* — weekly visit frequency, drop-off detection, at-risk flags.

---

## Tech stack

| | |
|---|---|
| **Backend** | Node.js · Express · TypeScript |
| **Frontend** | React · Vite · TypeScript |
| **Database** | PostgreSQL |
| **Auth** | JWT (HS256) · argon2id |
| **Local dev** | Docker Compose |

---

## Getting started

### Prerequisites

- [Docker](https://www.docker.com/) — for Postgres
- [Node.js](https://nodejs.org/) v20+

### 1. Clone and start the database

```bash
git clone https://github.com/Omnipotara/gymify.git
cd gymify
docker compose up -d
```

### 2. Backend

```bash
cd backend
cp .env.example .env    # edit values as needed
npm install
npm run migrate         # run DB migrations
npm run seed            # create demo gym + users
npm run dev             # starts on http://localhost:3000
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev             # starts on http://localhost:5173
```

### 4. Try it out

The seed script creates a demo gym with a join QR and a check-in QR. QR images are saved to `backend/seed-output/` — open them on your phone or display them on screen to test the full scan flow.

---

## Project status

Currently building **Slice 1 — Join a gym + check in**. This is the foundation slice: auth, QR pipeline, multi-tenant data model, and the React frontend all wired together end-to-end.

| Slice | Status | Description |
|-------|--------|-------------|
| 1 — Join + check in | 🚧 In progress | Register, join a gym via QR, check in, view history |
| 2 — Admin + memberships | Planned | Member list, membership management, admin dashboard |
| 3 — Retention analytics | Planned | Visit frequency, drop-off trends, at-risk detection |
| 4 — Loyalty | Planned | Rewards and engagement features |

---

## Architecture

Gymify is a standard three-tier web app: React frontend → Express API → PostgreSQL. The backend follows a strict controller / service / repository separation, and every gym-scoped database query filters by `gym_id` at every layer — tenancy isolation is the single most important correctness property in the system.

See [`docs/`](./docs/) for the full design documentation:

- [`docs/00-overview.md`](./docs/00-overview.md) — product vision and locked decisions
- [`docs/01-architecture.md`](./docs/01-architecture.md) — folder structure and conventions
- [`docs/02-data-model.md`](./docs/02-data-model.md) — database schema
- [`docs/03-auth-and-roles.md`](./docs/03-auth-and-roles.md) — auth and roles
- [`docs/04-qr-system.md`](./docs/04-qr-system.md) — QR join and check-in design
- [`docs/06-security.md`](./docs/06-security.md) — tenancy and security rules

---

## License

MIT
