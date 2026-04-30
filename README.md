# Musico 🎵

A professional, high-performance open-source music discovery platform and social network for audiophiles, inspired by Letterboxd. Built with a modern TypeScript monorepo architecture, Musico provides a seamless experience for exploring, rating, and sharing music.

[![CI](https://github.com/moKshagna-p/musico/actions/workflows/ci.yml/badge.svg)](https://github.com/moKshagna-p/musico/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🌟 Key Features

- **Dynamic Music Discovery:** Deep integration with the Discogs API for comprehensive release metadata and search.
- **Social Engagement:** Rate albums, write reviews, and follow other users to see their activity.
- **Personal Collections:** Create and manage custom lists (e.g., "Listen Later", "All-Time Favorites").
- **Smart Caching:** Multi-layer caching strategy using PostgreSQL (SHA-256 query hashing) and in-memory TTLs to minimize upstream latency.
- **Robust Security:** Full-stack authentication powered by Better Auth with session management and account isolation.
- **Performance Optimized:** Blur-up image loading, infinite scroll, and batched API endpoints for a sub-second perceived load time.
- **Rate Limiting & Protection:** Built-in IP-based abuse protection and automated health monitoring.

## 🏗️ Architecture

Musico is structured as a **Turbo Monorepo**, ensuring fast builds and clear separation of concerns:

- **`apps/web`**: A modern React frontend built with Vite, TailwindCSS, and TanStack Query.
- **`apps/api`**: A high-performance Bun/Elysia backend acting as an intelligent proxy and data orchestrator.
- **Database**: PostgreSQL (via Neon) managed by Drizzle ORM for type-safe migrations and queries.

## 🛠️ Tech Stack

| Frontend | Backend | Infrastructure |
| :--- | :--- | :--- |
| React 18+ (Vite) | Bun + Elysia | PostgreSQL (Neon) |
| TailwindCSS | Drizzle ORM | Redis (Optional Cache) |
| TanStack Query | Better Auth | Turbo (Build System) |

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Bun](https://bun.sh) 1.0+ (required for backend)
- A PostgreSQL database (e.g., [Neon](https://neon.tech))

### Installation

1. **Clone and Install:**
   ```bash
   git clone https://github.com/moKshagna-p/musico.git
   cd musico
   bun install
   ```

2. **Environment Setup:**
   Copy `.env.example` to `.env` in the root and configure your variables (`DATABASE_URL`, `DISCOGS_TOKEN`, `BETTER_AUTH_SECRET`).

3. **Database Migrations:**
   ```bash
   bun run db:migrate:api
   ```

4. **Run Development Server:**
   ```bash
   bun run dev
   ```
   The frontend will be at `http://localhost:5173` and the API at `http://localhost:4000`.

## 🧪 Testing & Quality

We maintain high standards for code quality and reliability:

- **Linting:** `bun run lint`
- **Unit Tests:** `bun run test`
- **E2E Tests:** `npx playwright test`

## 🤝 Contributing

We welcome contributions from the community! Feel free to open an issue or submit a pull request with your improvements.

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

---
*Built with ❤️ for the music community.*
