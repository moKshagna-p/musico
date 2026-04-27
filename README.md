# Musico

Turbo monorepo for a React/Vite frontend and a Bun/Elysia API proxy.

## Monorepo Layout

- `apps/web` - React + Vite frontend.
- `apps/api` - Bun + Elysia backend.

## Requirements

- Node.js 18+ for workspace tooling and frontend.
- [Bun](https://bun.sh) 1.0+ for the backend runtime.

## Setup

1. Install dependencies:
   - `npm install` (or `bun install`)
2. Copy `.env.example` to `.env` at the repo root and fill:
   - `VITE_API_BASE_URL` - backend origin (defaults to `http://localhost:4000`).
   - `PORT`, `ALLOWED_ORIGIN`, `DISCOGS_TOKEN` (+ optional `DISCOGS_KEY`/`DISCOGS_SECRET`).
   - Optional cache TTL overrides: `FEATURED_CACHE_TTL_MS`, `SEARCH_CACHE_TTL_MS`.
   - `DATABASE_URL` for Neon Postgres.
   - `BETTER_AUTH_URL` and `BETTER_AUTH_SECRET` for authentication.
3. Start everything:
   - `bun run dev` (or `npm run dev`)

## Scripts

- `npm run check:bun` - verify Bun is installed before backend/monorepo tasks.
- `npm run dev` - run `apps/web` and `apps/api` in parallel via Turbo (requires Bun).
- `npm run build` - build all apps that expose `build` (requires Bun).
- `npm run lint` - lint the frontend app.
- `npm run test` - run frontend unit tests.
- `npm run dev:web` - run frontend only.
- `npm run dev:api` - run backend only (requires Bun).
- `npm run start:api` - start backend once.
- `npm run start:api:local` - start backend once using the root `.env`.
- `npm run db:migrate:api` - apply backend migrations using process environment variables.
- `npm run build:web` - build the frontend app only.
- `npm run start:web` - serve the built frontend in a Railway-friendly way.

## Auth

- Better Auth is mounted in the API at `/api/auth/*`.
- Email/password auth is enabled.
- Auth data is stored in Neon Postgres via Drizzle ORM.
- Web auth page is available at `/auth`.
- Better Auth Drizzle schema is defined in `apps/api/schema.ts`.

## Database

- Drizzle config: `apps/api/drizzle.config.ts`
- Migration files: `apps/api/drizzle/*`
- Generate migration: `bun run --cwd apps/api db:generate`
- Apply migration: `bun run --cwd apps/api db:migrate`
- Open Drizzle Studio: `bun run --cwd apps/api db:studio`
- Production API start applies pending Drizzle migrations before boot.

## Backend behavior

- Proxies Discogs search/release endpoints while normalizing payloads for UI use.
- Stores most happening and recent release snapshots in Postgres, prewarms top release details, and refreshes them weekly.
- Stores search results in Postgres using SHA-256 query hashes to reuse repeated searches and reduce upstream API calls.
- Stores ratings and lists in Postgres per authenticated user (`/api/me/*`) so profile data is isolated by account.
- Keeps release detail caching in memory for 1 hour.
- Applies IP-based abuse protection (100 requests/hour) and returns `429` with `Retry-After` headers when exceeded.

## Production deployment

- The API exposes:
  - `GET /health` for process health
  - `GET /ready` for readiness including database connectivity
- For weekly snapshot refresh, schedule `GET /api/cron/home-refresh` with `Authorization: Bearer <CRON_SECRET>` from Railway/Vercel Cron or another scheduler.
- Production startup requires runtime env vars and does not read from the root `.env` file automatically.
- Recommended production split:
  - deploy `apps/api` as a backend service
  - deploy `apps/web` as a separate frontend service
