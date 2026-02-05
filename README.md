# MuseVault

React + Vite frontend for browsing and rating Discogs releases paired with a Bun/Elysia proxy that caches calls for an hour and rate-limits abusive clients.

## Requirements

- Node.js 18+ for the Vite app.
- [Bun](https://bun.sh) 1.0+ for the Elysia backend.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` (or export the variables another way) and fill in:
   - `VITE_API_BASE_URL` – origin of the Elysia server (defaults to `http://localhost:4000`).
   - `PORT`, `ALLOWED_ORIGIN` (e.g. `http://localhost:5173` for the Vite dev server), and `DISCOGS_TOKEN` (your Discogs personal access token). Key/secret auth is optional—only add `DISCOGS_KEY`/`DISCOGS_SECRET` if you already have them.
3. Start the backend: `npm run server:dev`
4. In another terminal start the frontend: `npm run dev`

## Available Scripts

- `npm run dev` – Vite dev server.
- `npm run build` – production build.
- `npm run preview` – preview the production build locally.
- `npm run lint` – lint the project.
- `npm run server` – start the Bun/Elysia proxy once.
- `npm run server:dev` – start the proxy in watch mode for development.

## Backend behavior

- Proxies Discogs search/release endpoints while normalizing the payload for the UI.
- Caches featured lists, search results, and release details for 1 hour, so repeat queries (e.g., “Beatles”) return instantly without additional Discogs calls.
- Applies IP-based abuse protection (100 requests/hour) and returns `429` with `Retry-After` headers when exceeded.
