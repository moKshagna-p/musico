# Cloudflare Workers Deployment

This API can run in two modes:

- Local/server mode: `server.ts` runs the same Elysia app with Bun and `.listen(...)`.
- Cloudflare mode: `worker.ts` uses Elysia's Cloudflare Worker adapter and exports `.compile()`.

## First Deploy

1. Install dependencies from the repo root:

```sh
bun install
```

2. Log in to Cloudflare:

```sh
bunx wrangler login
```

3. Add production secrets from `apps/api`:

```sh
bunx wrangler secret put DATABASE_URL
bunx wrangler secret put BETTER_AUTH_URL
bunx wrangler secret put BETTER_AUTH_SECRET
bunx wrangler secret put DISCOGS_TOKEN
bunx wrangler secret put CRON_SECRET
```

Use `wrangler.toml` `[vars]` for non-secret config like `ALLOWED_ORIGIN` and `DISCOGS_USER_AGENT`.

4. Deploy:

```sh
bun run --cwd apps/api worker:deploy
```

## Required Cloudflare Variables

Set these in Cloudflare Workers -> Settings -> Variables and Secrets.

Secrets:

- `DATABASE_URL`: Neon pooled Postgres URL.
- `BETTER_AUTH_URL`: your API origin. If Vercel rewrites `/api` to the Worker, use the Vercel site origin, for example `https://your-app.vercel.app`.
- `BETTER_AUTH_SECRET`: same value you used before.
- `DISCOGS_TOKEN`: Discogs token.
- `CRON_SECRET`: long random value if you use admin/refresh endpoints.

Plain variables:

- `ALLOWED_ORIGIN`: your frontend origin, for example `https://your-app.vercel.app`.
- `DISCOGS_USER_AGENT`: for example `musico/1.0 (+https://your-app.vercel.app)`.
- `FEATURED_CACHE_TTL_MS`: optional, defaults to `604800000`.
- `SEARCH_CACHE_TTL_MS`: optional, defaults to `604800000`.
- `DISCOGS_MIN_REQUEST_INTERVAL_MS`: optional, defaults to `1100`.
- `HOME_RELEASE_DETAILS_PREWARM_LIMIT`: optional, defaults to `6`.

## Vercel Frontend Changes

Keep same-origin auth by rewriting `/api` to the Worker.

In `apps/web/vercel.json`, replace the old Railway URL with your Worker URL:

```json
{
  "source": "/api/:path*",
  "destination": "https://musico-api.<your-subdomain>.workers.dev/api/:path*"
}
```

and:

```json
{
  "source": "/api",
  "destination": "https://musico-api.<your-subdomain>.workers.dev/api"
}
```

For this same-origin rewrite setup, do not set `VITE_API_BASE_URL` in Vercel production. The frontend intentionally uses `window.location.origin` on Vercel so cookies go through the Vercel domain.

For local development, keep:

```txt
VITE_API_BASE_URL=http://localhost:4000
```

or, when testing the Worker locally:

```txt
VITE_API_BASE_URL=http://localhost:8787
```
