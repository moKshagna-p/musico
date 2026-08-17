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
bunx wrangler secret put BETTER_AUTH_SECRET
bunx wrangler secret put DISCOGS_TOKEN
bunx wrangler secret put CRON_SECRET
```

Use `wrangler.toml` `[vars]` for non-secret config like `ALLOWED_ORIGIN`,
`BETTER_AUTH_URL`, and `DISCOGS_USER_AGENT`.

4. Deploy:

```sh
bun run --cwd apps/api worker:deploy
```

## Required Cloudflare Variables

Set these in Cloudflare Workers -> Settings -> Variables and Secrets.

Secrets:

- `DATABASE_URL`: Neon pooled Postgres URL.
- `BETTER_AUTH_SECRET`: same value you used before.
- `DISCOGS_TOKEN`: Discogs token.
- `CRON_SECRET`: dedicated long random value for manual refresh endpoints. Do not reuse the Better Auth secret.

Plain variables:

- `ALLOWED_ORIGIN`: your frontend origin, for example `https://your-app.vercel.app`.
- `BETTER_AUTH_URL`: your API origin. If Vercel rewrites `/api` to the Worker, use the Vercel site origin, for example `https://your-app.vercel.app`.
- `DISCOGS_USER_AGENT`: for example `musico/1.0 (+https://your-app.vercel.app)`.
- `FEATURED_CACHE_TTL_MS`: optional, capped at `21300000` (5 hours 55 minutes).
- `SEARCH_CACHE_TTL_MS`: optional, capped at `21300000` (5 hours 55 minutes).
- `DISCOGS_MIN_REQUEST_INTERVAL_MS`: optional, defaults to `1100`.
- `DISCOGS_REQUEST_TIMEOUT_MS`: optional, defaults to `10000`.
- `HOMEPAGE_REFRESH_MINIMAL`: optional, defaults to `false`; leave it disabled so the Billboard snapshot replaces older homepage albums.
- `HOME_RELEASE_DETAILS_PREWARM_LIMIT`: optional, defaults to `6`.

## First Administrator

After migrations are applied and the intended administrator has created an
account, grant that account the role from a secure operator shell with the
production `DATABASE_URL` available:

```sh
bun run --cwd apps/api admin:grant -- admin@example.com
```

The command only writes to `admin_user`; no source-controlled email address can
grant administrator access. Keep at least one administrator active before
removing another administrator's role.

## Manual Refreshes

Manual homepage refreshes are `POST` endpoints. Send the dedicated cron secret
only in the Authorization header:

```sh
curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  "https://your-app.vercel.app/api/cron/home-refresh"
```

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
