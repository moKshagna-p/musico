# Musico

Musico is a high-performance open-source platform for music discovery and social interaction. Inspired by the community-centric model of Letterboxd, it provides a dedicated space for users to explore, rate, and review albums while maintaining personal collections.

## Core Capabilities

- **Discovery and Search**: Deep integration with the Discogs API provides comprehensive access to global music metadata.
- **Social Interaction**: Users can rate releases, share written reviews, and follow others to stay updated on community activity.
- **Collection Management**: Support for custom lists, such as "Listen Later" or personal favorites, to help users organize their musical journey.
- **Engineered for Speed**: A multi-layered caching strategy using PostgreSQL and in-memory TTLs ensures minimal latency and reduced overhead on upstream APIs.
- **Security and Privacy**: Built on Better Auth, providing robust session management and complete data isolation between accounts.
- **Optimization**: Features like blur-up image loading, infinite scroll, and batched API responses prioritize a smooth user experience.

## System Architecture

Musico is built as a TypeScript monorepo managed by Turbo, ensuring a clean separation of concerns and efficient build cycles.

- **Frontend**: A modern React application utilizing Vite, TailwindCSS, and TanStack Query for a responsive interface.
- **API Service**: A backend built with Bun and Elysia that serves as a high-performance orchestrator and API proxy.
- **Persistence**: PostgreSQL (via Neon) managed by Drizzle ORM for type-safe database operations.

## Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18+, Vite, TailwindCSS, TanStack Query |
| **Backend** | Bun, Elysia, Better Auth |
| **Data** | PostgreSQL, Drizzle ORM |
| **Tooling** | Turbo, mprocs, Playwright, Vitest |

## Getting Started

### Prerequisites

- Node.js 22+
- Bun 1.3.10+
- A PostgreSQL instance (e.g., Neon)

### Setup

1. **Initialize**:
   ```bash
   git clone https://github.com/moKshagna-p/musico.git
   cd musico
   bun install
   ```

2. **Configuration**:
   Copy `.env.example` to `.env` and provide values for `DATABASE_URL`, `DISCOGS_TOKEN`, and `BETTER_AUTH_SECRET`.

3. **Database**:
   ```bash
   bun run db:migrate:api
   ```

4. **Development**:
   ```bash
   bun run dev
   ```
   mprocs starts the web and API services in separate panes. The application will be available at `http://localhost:5173` with the API service at `http://localhost:4000`.

## Quality Standards

We maintain reliability through comprehensive testing and linting:

- **Linting**: `bun run lint`
- **Unit Testing**: `bun run test` (Bun API tests and Node's built-in web tests)
- **E2E Testing**: `npx playwright test`

## Release Workflow

Normal pushes and pull requests run CI checks only. Production deployments run from the `Release` workflow when a `v*` tag is pushed or the workflow is started manually.

Release deployments require these GitHub Actions secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Store them as `production` environment secrets because the deploy jobs target the
`production` GitHub Actions environment:

```sh
gh secret set CLOUDFLARE_API_TOKEN --env production
gh secret set CLOUDFLARE_ACCOUNT_ID --env production
gh secret set VERCEL_TOKEN --env production
gh secret set VERCEL_ORG_ID --env production
gh secret set VERCEL_PROJECT_ID --env production
```

If any of these are missing, the release workflow fails before attempting the
Cloudflare Worker or Vercel deploy.

## Production Security

- Provision the first administrator with the operator-only command in
  [`apps/api/CLOUDFLARE.md`](apps/api/CLOUDFLARE.md). Runtime admin access is
  granted only through the `admin_user` table.
- Set a dedicated, high-entropy `CRON_SECRET`. Cron refresh endpoints accept
  `POST` requests with `Authorization: Bearer <CRON_SECRET>` only.
- Configure Cloudflare WAF/rate-limiting rules for `/api/auth/*`, `/api/search`,
  and `/api/releases/*`; the Worker limiter is intentionally a bounded local
  fallback, not global DDoS protection.

## Contributing

Contributions are welcome. If you have improvements or bug fixes, please open an issue or submit a pull request for review.
