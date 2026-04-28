process.env.HOMEPAGE_REFRESH_MINIMAL ??= 'false'

const { refreshStoredHomeAlbums, refreshStoredTrendingAlbums } = await import('../trending')

const parseLimit = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const happeningLimit = parseLimit(process.env.HAPPENING_LIMIT, 24)
const recentLimit = parseLimit(process.env.RECENT_LIMIT, 24)
const mode = process.env.MODE === 'featured' || process.env.MODE === 'recent-popular' ? process.env.MODE : 'all'

console.log(`Refreshing homepage snapshots: mode=${mode}, featured=${happeningLimit}, recent-popular=${recentLimit}`)

const startedAt = Date.now()

if (mode === 'featured' || mode === 'recent-popular') {
  const result = await refreshStoredTrendingAlbums(mode, mode === 'featured' ? happeningLimit : recentLimit)
  console.log(
    JSON.stringify(
      {
        ok: true,
        durationMs: Date.now() - startedAt,
        mode,
        insertedOrUpdated: result.insertedOrUpdated,
        snapshotSize: result.data.length,
        refreshedAt: result.refreshedAt.toISOString(),
      },
      null,
      2,
    ),
  )
  process.exit(0)
}

const result = await refreshStoredHomeAlbums({ happeningLimit, recentLimit })

console.log(
  JSON.stringify(
    {
      ok: true,
      durationMs: Date.now() - startedAt,
      mostHappening: {
        insertedOrUpdated: result.mostHappening.insertedOrUpdated,
        snapshotSize: result.mostHappening.data.length,
        refreshedAt: result.mostHappening.refreshedAt.toISOString(),
      },
      recentReleases: {
        insertedOrUpdated: result.recentReleases.insertedOrUpdated,
        snapshotSize: result.recentReleases.data.length,
        refreshedAt: result.recentReleases.refreshedAt.toISOString(),
      },
    },
    null,
    2,
  ),
)
