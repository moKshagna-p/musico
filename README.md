# MuseVault

Turbo monorepo for a React/Vite frontend and a Bun/Elysia API proxy.

## Monorepo Layout

- `apps/web` - React + Vite frontend.
- `apps/api` - Bun + Elysia backend.
- `packages/*` - shared packages (empty scaffold for now).

## Requirements

- Node.js 18+ for workspace tooling and frontend.
- [Bun](https://bun.sh) 1.0+ for the backend runtime.

## Setup

1. Install dependencies:
   - `npm install`
2. Copy `.env.example` to `.env` at the repo root and fill:
   - `VITE_API_BASE_URL` - backend origin (defaults to `http://localhost:4000`).
   - `PORT`, `ALLOWED_ORIGIN`, `DISCOGS_TOKEN` (+ optional `DISCOGS_KEY`/`DISCOGS_SECRET`).
3. Start everything:
   - `npm run dev`

## Scripts

- `npm run dev` - run `apps/web` and `apps/api` in parallel via Turbo.
- `npm run build` - build all apps that expose `build`.
- `npm run lint` - lint all apps that expose `lint`.
- `npm run preview` - preview the web build.
- `npm run dev:web` - run frontend only.
- `npm run dev:api` - run backend only.
- `npm run start:api` - start backend once.

## Backend behavior

- Proxies Discogs search/release endpoints while normalizing payloads for UI use.
- Caches featured lists, search results, and release details for 1 hour.
- Applies IP-based abuse protection (100 requests/hour) and returns `429` with `Retry-After` headers when exceeded.
