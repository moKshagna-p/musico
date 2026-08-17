# Home Chart and Search Quality Design

## Goal

Serve the homepage's Most Happening section from a stored, strict current Billboard snapshot and return materially better catalog search results.

## Homepage snapshot

The Worker refreshes the two existing `stored_trending_album` modes every six hours. The featured mode is a replacement snapshot: only albums matched from the current Billboard chart receive the new `lastSeenAt` and are visible to `/api/home`. The existing fallback to generic Discogs-popular releases is removed. Historical rows may remain in Postgres but are excluded by the latest-snapshot query.

The recent-releases mode keeps its current source. No new table, provider, or migration is needed.

## Search quality

Search normalization preserves Unicode letters and numbers. Ranking treats an exact `artist + album` query as exact intent. The full search-results page accepts any non-empty query; predictive suggestions retain the three-character threshold. Discover records its submitted query through the existing search-event endpoint so its activity can influence existing recent-release selection.

## Error handling and verification

If Billboard matching produces fewer than the requested limit, the homepage displays the shorter verified Billboard set rather than unrelated albums. Regression tests cover strict snapshot replacement, Unicode and artist-album ranking, short full searches, and Discover search-event recording.

## Constraints

- Reuse Postgres, Discogs, TanStack Query, and existing request helpers.
- Add no package or schema migration.
- Keep scheduled Discogs-derived data refreshes inside the existing six-hour freshness ceiling.
