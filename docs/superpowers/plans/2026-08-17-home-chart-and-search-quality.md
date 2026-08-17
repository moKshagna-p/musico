# Home Chart and Search Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace stale mixed homepage charts with current stored Billboard matches and improve search relevance.

**Architecture:** Reuse `stored_trending_album` snapshots and the existing Worker cron. Make featured snapshots replace active rows, remove generic fallback, and make small ranking changes in the existing Discogs service.

**Tech Stack:** Bun, TypeScript, Elysia, React, TanStack Query, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-17-home-chart-and-search-quality-design.md`

## Global Constraints

- No dependencies or database migration.
- Featured output contains only current Billboard matches.
- Scheduled refresh interval is six hours.
- Each behavior change has a failing regression test first.

---

### Task 1: Strict stored Billboard snapshot

**Files:**
- Modify: `apps/api/src/core/env.ts`
- Modify: `apps/api/src/services/trending.ts`
- Modify: `apps/api/wrangler.toml`
- Create: `apps/api/src/services/trending.test.ts`

**Interfaces:**
- Produces: `refreshStoredTrendingAlbums('featured', limit)` persists only matched Billboard releases as the active featured snapshot.

- [ ] **Step 1: Write failing snapshot tests**

```ts
test('featured refresh replaces the active snapshot instead of re-promoting older albums', async () => {
  // seed old rows, refresh with current matched rows, and assert only current IDs are active
})

test('featured refresh does not use generic Discogs releases to fill missing Billboard matches', async () => {
  // mock fewer chart matches than limit and assert the result stays short
})
```

- [ ] **Step 2: Run the focused API test and verify failure**

Run: `bun run --cwd apps/api test src/services/trending.test.ts`

- [ ] **Step 3: Replace active featured rows and configure a six-hour cron**

```ts
return mode === 'featured' ? upsertStoredSnapshot(mode, snapshot) : mergeStoredSnapshot(mode, snapshot)
```

- [ ] **Step 4: Run targeted API tests**

Run: `bun run --cwd apps/api test`

### Task 2: Search intent and Discover signals

**Files:**
- Modify: `apps/api/src/services/discogs.ts`
- Modify: `apps/web/src/hooks/useSearch.js`
- Modify: `apps/web/src/pages/SearchResults.jsx`
- Modify: `apps/web/src/pages/Discover.jsx`
- Modify: `apps/api/src/services/discogs.test.ts`
- Modify: `apps/web/e2e/critical-flows.spec.ts`

**Interfaces:**
- Produces: Unicode, short full-page, and exact artist-album queries return the intended result; Discover posts one existing search signal per submitted query.

- [ ] **Step 1: Write failing ranking and browser tests**

```ts
test('ranks an exact artist and album match above a more popular partial match', () => {
  // Daft Punk Discovery must rank ahead of a partial match
})

test('search submission from Discover records the query', async ({ page }) => {
  // submit U2 and assert POST /api/search-events and GET /api/search
})
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `bun run --cwd apps/api test src/services/discogs.test.ts && bunx playwright test apps/web/e2e/critical-flows.spec.ts --grep "Discover"

- [ ] **Step 3: Implement the smallest ranking and request changes**

```ts
const normalizedArtistAlbum = normalizeSearchValue(`${release.artists?.[0] ?? ''} ${release.name ?? ''}`)
const exactArtistAlbum = normalizedArtistAlbum === normalizedQuery
```

- [ ] **Step 4: Run targeted tests**

Run: `bun run --cwd apps/api test && bun run test:e2e`

### Task 3: Verify and open the linked PR

**Files:**
- Modify: files from Tasks 1 and 2 only

- [ ] **Step 1: Run repository verification**

Run: `bun run test && bun run build && bun run lint && bun run test:e2e`

- [ ] **Step 2: Check the final diff**

Run: `git diff --check && git diff --stat`

- [ ] **Step 3: Commit and open a PR that closes the issue**

```bash
git commit -am "fix: refresh chart snapshots and improve search"
```
