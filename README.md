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
| **Tooling** | Turbo, Playwright, Vitest |

## Getting Started

### Prerequisites

- Node.js 18+
- Bun 1.0+
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
   The application will be available at `http://localhost:5173` with the API service at `http://localhost:4000`.

## Quality Standards

We maintain reliability through comprehensive testing and linting:

- **Linting**: `bun run lint`
- **Unit Testing**: `bun run test`
- **E2E Testing**: `npx playwright test`

## Releases and Automation

- **Manual Releases**: Releases are triggered manually via the GitHub Actions "Release" workflow. This allows for controlled deployment of new features and version tagging.
- **Dependency Management**: Dependabot is configured to check for weekly updates to our dependencies, ensuring the platform remains secure and up-to-date.

## Contributing

Contributions are welcome. If you have improvements or bug fixes, please open an issue or submit a pull request for review.

## License

Distributed under the MIT License. See `LICENSE` for details.
