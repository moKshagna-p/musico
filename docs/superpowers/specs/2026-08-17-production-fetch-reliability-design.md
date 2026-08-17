# Production Fetch Reliability Design

## Goal

Make Musico's existing Discogs-backed fetch path fail quickly, recover from transient upstream failures, and avoid preserving failed data in browser caches.

## Scope

1. Add a bounded timeout and retry path for transient Discogs network failures in the shared request function.
2. Keep `Retry-After` and existing HTTP retry behavior; do not retry non-retryable 4xx responses.
3. Do not cache a partially failed `/api/home` response in the web client.
4. Change search pagination to request the API-provided `nextOffset` and append pages rather than refetching offset zero with a larger limit.
5. Cap Discogs-derived cache and CDN freshness to less than six hours, in line with the Discogs API Terms of Use.

## Non-goals

- Migrating metadata providers.
- Reworking the homepage refresh architecture or proxy-level rate limiter.
- Adding packages or new persistence layers.

## Design

The existing `requestDiscogs` function remains the single upstream boundary. It will create a timeout-capable request and treat an aborted/network fetch as retryable under the existing retry budget. Tests will mock the global fetch to prove retry and non-retry behavior.

The web service will only update its five-minute home cache when both home sections are healthy. Search results will preserve existing TanStack Query usage while storing pages locally in the page component and using the returned continuation offset.

All cache windows that expose Discogs metadata will use a five-hour-fifty-five-minute ceiling. Musico-owned review and rating data continues to be hydrated at response time.

## Verification

- Targeted Bun API tests for upstream retries, timeout behavior, and cache limits.
- Targeted web tests for home-cache failure recovery and offset pagination.
- API/web tests and production web build.
