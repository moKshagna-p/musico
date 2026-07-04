# Musico - Project Context for LLMs

Welcome! If you are an AI agent or LLM reading this, this document is designed to give you a quick, comprehensive understanding of the Musico project structure, its architecture, and conventions to help you write better code and assist effectively.

## Project Overview

**Musico** is an open-source platform for music discovery and social interaction. It acts as a community-centric space to explore, rate, and review albums, built around the Discogs API.

This project is a **TypeScript monorepo** managed by **Turbo**, utilizing **Bun** as the package manager.

## Monorepo Structure

The workspace is defined for `apps/*` and `packages/*`. The primary code resides in the `apps/` directory.

### 1. `apps/api` (Backend)
- **Framework**: ElysiaJS running on Bun.
- **Role**: Serves as a high-performance orchestrator, API proxy to Discogs, and handles backend business logic.
- **Database**: PostgreSQL (via Neon) using **Drizzle ORM** for type-safe database operations.
- **Authentication**: **Better Auth**.
- **Deployment Strategy**: Deployed to Cloudflare Workers (see `worker.ts` and `wrangler.toml`), but can also run via a standard Bun server (`server.ts`).
- **Key Concepts**: It uses a multi-layered caching strategy (PostgreSQL + in-memory TTLs) to minimize Discogs API calls and reduce latency.

### 2. `apps/web` (Frontend)
- **Framework**: React 18+ bundled with Vite.
- **Styling**: TailwindCSS.
- **State Management & Data Fetching**: TanStack Query (React Query) for managing server state and caching.
- **Testing**: Playwright for E2E testing (`playwright-report`, `test-results` in root).
- **Key Features**: Infinite scroll, blur-up image loading, and responsive user interfaces.

## Technology Stack Summary

- **Package Manager**: Bun (`bun@1.3.10` or higher)
- **Monorepo Manager**: Turbo (`turbo.json`)
- **Frontend**: React, Vite, TailwindCSS, TanStack Query
- **Backend**: Bun, Elysia
- **Database / ORM**: PostgreSQL, Drizzle ORM
- **Testing**: Vitest (Unit), Playwright (E2E)
- **Process Manager**: `mprocs` (used in dev mode to run web and API together)

## Development Workflow

- Run `bun install` to install dependencies.
- **Local Dev Server**: Run `bun run dev` at the root. This uses `mprocs` to launch both `apps/web` and `apps/api` concurrently.
  - Web UI: `http://localhost:5173`
  - API Service: `http://localhost:4000`
- **Database Migrations**: `bun run db:migrate:api`
- Environment variables are managed via `.env` (derived from `.env.example`).
  - Important variables: `DATABASE_URL`, `DISCOGS_TOKEN`, `BETTER_AUTH_SECRET`.

## Architectural Rules & Guidelines for LLMs

### Frontend Conventions (`apps/web`)
1. **Language**: The frontend is written in **JavaScript (`.jsx`)**, *not* TypeScript. Do not create `.tsx` or `.ts` files in the web app unless specifically asked to migrate.
2. **Data Fetching**: Always use **TanStack Query** (React Query) combined with Axios for fetching data from the API. Avoid using `useEffect` for data fetching.
3. **UI & Styling**: Use **TailwindCSS** for styling and **Framer Motion** for animations. Keep components functional and prefer early returns.
4. **State Management**: Use React Context for global state (refer to existing files in `apps/web/src/context`).

### Backend Conventions (`apps/api`)
1. **Strict TypeScript**: Enforce type safety in the backend. Use Drizzle's generated types or Elysia's schema validation (`t` from `elysia`) where applicable.
2. **Database Changes**: When updating database models in `apps/api/drizzle/schema.ts`, ensure Drizzle migrations are correctly planned and generated. Do not manually edit migration SQL files.
3. **Error Handling**: Use consistent error handling and standard HTTP status codes. Avoid swallowing errors; ensure they are logged and appropriately returned to the frontend.

## General Guidelines

1. **Package Manager**: **Always use `bun`** for installing packages, running scripts, and managing dependencies. Avoid `npm` or `yarn` (unless running specific npm script aliases defined in `package.json` like `npm run check:bun`).
2. **Component Structure**: Keep React components modular. Place reusable components in `apps/web/src/components` and page-level views in `apps/web/src/pages`.
3. **Testing**: Add or update tests when modifying logic. Use Vitest/Node for unit tests and Playwright for E2E tests.

When making modifications or adding features, ensure you check the relevant configuration files (`turbo.json`, `package.json`) to understand the linking between workspaces.
