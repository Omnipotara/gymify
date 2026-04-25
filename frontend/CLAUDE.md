# Frontend — Working Notes

> Loaded automatically when working inside `frontend/`.

## Stack specifics

- React 18+, TypeScript
- Vite as the build tool
- React Router for routing
- TanStack Query for server state (caching, polling, refetch)
- A QR scanner library: prefer `@yudiel/react-qr-scanner` or `html5-qrcode` (whichever is more actively maintained at build time)
- Tailwind for styling, OR plain CSS modules — pick one in Slice 1, stick with it
- No global state library in v1 (no Redux, Zustand) — TanStack Query + React Context cover what we need

## Folder shape

```
src/
├── pages/           # route-level (LoginPage, GymListPage, GymPage)
├── features/        # mirror backend modules (auth, gyms, checkins)
│   └── <feature>/
│       ├── api.ts       # fetch wrappers, returns typed promises
│       ├── hooks.ts     # TanStack Query hooks
│       ├── components/  # feature-specific UI
│       └── types.ts
├── components/      # cross-feature shared UI (Button, Card, etc.)
├── lib/             # api client setup, auth helpers, QR parsing
├── routes.tsx
└── main.tsx
```

## API client

One `apiClient` in `lib/` wraps `fetch`:
- Attaches the JWT from auth context
- Parses the standard error envelope (`{ error: { code, message } }`)
- Throws typed errors that components can switch on

Don't call `fetch` directly from components or hooks.

## Auth context

`AuthProvider` in `lib/` holds the current user + JWT. On mount, it tries to restore from `localStorage` and validates with `GET /api/me`. Logout clears storage + state.

## Routing

- Public routes: `/login`, `/register`
- Protected routes: everything else, behind a `RequireAuth` wrapper that redirects to `/login`
- Gym-scoped routes use `/gyms/:gymId/*` — the `gymId` from the URL is what the page operates on

## QR scanning UX

- "Add gym" and "Check in" both open a camera scanner overlay
- On scan, parse the payload client-side just enough to know which API to call
- Show a clear success/error state — never leave the user wondering if it worked

## Don't

- Don't store JWTs in plain `document.cookie`
- Don't put business logic in components — derive it from server data via hooks
- Don't build a fancy design system — Slice 1 just needs to work
