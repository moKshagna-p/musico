# Production Fetch Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden existing Discogs requests and eliminate duplicate or failed client fetch caching.

**Architecture:** Keep one upstream request boundary in `discogs.ts`; add no dependencies. Preserve the current API contracts and use their existing `nextOffset` continuation for client pagination.

**Tech Stack:** Bun, TypeScript, Elysia, React, TanStack Query, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-17-production-fetch-reliability-design.md`

## Global Constraints

- Use Bun and existing dependencies only.
- Add a regression test before each production fix.
- Keep Discogs-derived cached content under six hours old.

---

### Task 1: Discogs request resilience

**Files:**
- Modify: `apps/api/src/services/discogs.ts`
- Create: `apps/api/src/services/discogs.test.ts`

**Interfaces:**
- Produces: existing `requestDiscogs(endpoint, params)` behavior with bounded retries.

- [ ] **Step 1: Write failing tests**

```ts
test('retries a transient fetch rejection before returning Discogs JSON', async () => {
  // reject once, resolve once, expect two calls and the resolved JSON
})

test('does not retry a 400 Discogs response', async () => {
  // resolve 400, expect one call and a rejection
})
```

- [ ] **Step 2: Run API test to verify it fails**

Run: `bun run --cwd apps/api test src/services/discogs.test.ts`

- [ ] **Step 3: Implement minimal timeout/retry handling**

```ts
try {
  response = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) })
} catch (error) {
  if (attempt < DISCOGS_MAX_RETRIES) continue
  throw error
}
```

- [ ] **Step 4: Run targeted and full API tests**

Run: `bun run --cwd apps/api test`

### Task 2: Cache correctness

**Files:**
- Modify: `apps/api/src/services/discogs.ts`
- Modify: `apps/api/src/core/env.ts`
- Modify: `apps/api/src/routes/albums.ts`
- Modify: `apps/web/src/services/discogsService.js`
- Test: `apps/api/src/services/discogs.test.ts`
- Create: `apps/web/src/services/discogsService.test.js`

**Interfaces:**
- Produces: failed home responses never become a fresh local cache entry.

- [ ] **Step 1: Write failing home-cache and freshness tests**

```js
test('re-fetches home sections after a partial failure', async () => {
  // return partial error then healthy data; expect two API calls
})
```

- [ ] **Step 2: Run targeted tests to verify failure**

Run: `bun run --cwd apps/web test -- src/services/discogsService.test.js`

- [ ] **Step 3: Apply cache ceiling and healthy-only home caching**

```js
if (mostHappening.error || recentReleases.error) return result
homeSectionsCache.timestamp = Date.now()
```

- [ ] **Step 4: Run API and web tests**

Run: `bun run --cwd apps/api test && bun run --cwd apps/web test`

### Task 3: Offset pagination

**Files:**
- Modify: `apps/web/src/pages/SearchResults.jsx`
- Test: `apps/web/e2e/critical-flows.spec.ts`

**Interfaces:**
- Consumes: `{ data, hasMore, nextOffset }` from `searchReleases`.
- Produces: Load More requests `nextOffset` and appends the returned results once.

- [ ] **Step 1: Write a failing pagination regression test**

```ts
test('search load more requests the next API offset and preserves first-page cards', async ({ page }) => {
  // intercept two requests and assert offsets 0 then 12
})
```

- [ ] **Step 2: Run the focused Playwright test to verify failure**

Run: `bunx playwright test apps/web/e2e/critical-flows.spec.ts --grep "search load more"`

- [ ] **Step 3: Store fetched pages and call the existing offset API contract**

```jsx
const nextPage = await searchReleases(query, { limit: PAGE_SIZE, offset: nextOffset })
setPages((pages) => [...pages, nextPage.data])
```

- [ ] **Step 4: Run web tests and build**

Run: `bun run --cwd apps/web test && bun run --cwd apps/web build`

### Task 4: Verify and prepare review

**Files:**
- Modify: files from Tasks 1-3 only

- [ ] **Step 1: Run full repository tests and build**

Run: `bun run test && bun run build`

- [ ] **Step 2: Review the diff against the design**

Run: `git diff --check && git diff --stat`

- [ ] **Step 3: Commit and open a linked pull request**

```bash
git commit -am "fix: harden production fetches"
```
