import type { Page, Route } from '@playwright/test'

type MockAlbum = {
  id: string
  name: string
  artists: string[]
  cover: string
  releaseDate: string | null
  releaseYear: number | null
  totalTracks: number
  albumType: string
  popularity: number
  genres: string[]
  communityRating: number
  reviewCount: number
  tracks: Array<{ id: string; name: string; duration_ms: number; track_number: number }>
  external_urls: {
    discogs: string
  }
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })

const parseBody = async (route: Route) => {
  const payload = route.request().postData()
  if (!payload) return {}
  try {
    return JSON.parse(payload) as Record<string, unknown>
  } catch {
    return {}
  }
}

const albumCatalog: MockAlbum[] = [
  {
    id: 'm:1001',
    name: 'Discovery',
    artists: ['Daft Punk'],
    cover: 'https://images.discogs.com/discovery.jpg',
    releaseDate: '2001-03-12',
    releaseYear: 2001,
    totalTracks: 14,
    albumType: 'Album',
    popularity: 92,
    genres: ['Electronic', 'House'],
    communityRating: 4.6,
    reviewCount: 120,
    tracks: [
      { id: 't-1001-1', name: 'One More Time', duration_ms: 320000, track_number: 1 },
      { id: 't-1001-2', name: 'Aerodynamic', duration_ms: 212000, track_number: 2 },
      { id: 't-1001-3', name: 'Digital Love', duration_ms: 301000, track_number: 3 },
    ],
    external_urls: {
      discogs: 'https://www.discogs.com/master/1001',
    },
  },
  {
    id: 'm:1002',
    name: 'Random Access Memories',
    artists: ['Daft Punk'],
    cover: 'https://images.discogs.com/ram.jpg',
    releaseDate: '2013-05-17',
    releaseYear: 2013,
    totalTracks: 13,
    albumType: 'Album',
    popularity: 90,
    genres: ['Electronic', 'Disco'],
    communityRating: 4.5,
    reviewCount: 109,
    tracks: [
      { id: 't-1002-1', name: 'Give Life Back to Music', duration_ms: 275000, track_number: 1 },
      { id: 't-1002-2', name: 'Get Lucky', duration_ms: 369000, track_number: 2 },
    ],
    external_urls: {
      discogs: 'https://www.discogs.com/master/1002',
    },
  },
  {
    id: 'm:1003',
    name: 'Homework',
    artists: ['Daft Punk'],
    cover: 'https://images.discogs.com/homework.jpg',
    releaseDate: '1997-01-20',
    releaseYear: 1997,
    totalTracks: 16,
    albumType: 'Album',
    popularity: 84,
    genres: ['Electronic', 'French House'],
    communityRating: 4.2,
    reviewCount: 88,
    tracks: [{ id: 't-1003-1', name: 'Daftendirekt', duration_ms: 164000, track_number: 1 }],
    external_urls: {
      discogs: 'https://www.discogs.com/master/1003',
    },
  },
]

const toSummary = (album: MockAlbum) => ({
  id: album.id,
  name: album.name,
  artists: album.artists,
  releaseDate: album.releaseDate,
  releaseYear: album.releaseYear,
  cover: album.cover,
  totalTracks: album.totalTracks,
  albumType: album.albumType,
  popularity: album.popularity,
  external_urls: album.external_urls,
  genres: album.genres,
  communityRating: album.communityRating,
  reviewCount: album.reviewCount,
})

const sanitizeListName = (value: unknown) =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 48)

export const installApiMocks = async (page: Page) => {
  const user = {
    id: 'user-e2e',
    email: 'e2e@musico.dev',
    name: 'E2E User',
    image: null,
  }

  const session = {
    id: 'session-e2e',
    userId: user.id,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
  }

  let signedIn = false
  const adminIds = new Set<string>()
  const bootstrapAdminEmail = 'mokshagnareddy45@gmail.com'

  const reviewsByAlbum = new Map<string, Array<{ id: string; content: string; user: { name: string; username: string }; createdAt: number; rating: number | null }>>()
  const ratings = new Map<string, number>()
  const lists = [
    {
      id: 'list-favorites',
      name: 'Favorites',
      albums: [] as Array<{ id: string; name: string; cover: string; artists: string[]; releaseYear: number | null; addedAt: number }>,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'list-listen-later',
      name: 'Listen Later',
      albums: [] as Array<{ id: string; name: string; cover: string; artists: string[]; releaseYear: number | null; addedAt: number }>,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ]

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const { pathname } = url
    const method = request.method().toUpperCase()

    if (pathname.startsWith('/api/auth/')) {
      if (pathname.includes('sign-in') || pathname.includes('sign-up')) {
        signedIn = true
        return json(route, {
          user,
          session,
        })
      }

      if (pathname.includes('sign-out')) {
        signedIn = false
        return json(route, { success: true })
      }

      if (pathname.includes('get-session') || pathname.includes('session')) {
        return json(route, signedIn ? { user, session } : null)
      }

      return json(route, { user: signedIn ? user : null, session: signedIn ? session : null })
    }

    if (pathname === '/api/admin/me' && method === 'GET') {
      if (!signedIn) return json(route, { error: 'Unauthorized.' }, 401)
      return json(route, {
        data: {
          isAdmin: adminIds.has(user.id) || user.email.toLowerCase() === bootstrapAdminEmail,
        },
      })
    }

    if (pathname === '/api/admin/users' && method === 'GET') {
      if (!signedIn) return json(route, { error: 'Forbidden.' }, 403)

      const q = String(url.searchParams.get('q') ?? '').toLowerCase().trim()
      const candidates = [
        {
          userId: user.id,
          name: user.name,
          email: user.email,
          username: 'e2e-user',
          image: null,
          createdAt: Date.now(),
          isAdmin: adminIds.has(user.id),
          isBootstrapAdmin: false,
        },
      ]

      const filtered = q
        ? candidates.filter((entry) =>
            entry.name.toLowerCase().includes(q) ||
            entry.email.toLowerCase().includes(q) ||
            String(entry.username ?? '').toLowerCase().includes(q),
          )
        : candidates

      return json(route, { data: filtered })
    }

    if (/\/api\/admin\/users\/[^/]+\/admin$/.test(pathname) && method === 'PUT') {
      if (!signedIn) return json(route, { error: 'Forbidden.' }, 403)
      const body = await parseBody(route)
      const nextIsAdmin = Boolean(body.isAdmin)

      if (nextIsAdmin) adminIds.add(user.id)
      else adminIds.delete(user.id)

      return json(route, {
        data: {
          userId: user.id,
          name: user.name,
          email: user.email,
          username: 'e2e-user',
          image: null,
          createdAt: Date.now(),
          isAdmin: nextIsAdmin,
          isBootstrapAdmin: false,
        },
      })
    }

    if (pathname === '/api/search-events' && method === 'POST') {
      return json(route, { ok: true })
    }

    if (pathname === '/api/featured' && method === 'GET') {
      return json(route, { data: albumCatalog.map(toSummary) })
    }

    if (pathname === '/api/home' && method === 'GET') {
      return json(route, {
        mostHappening: { data: albumCatalog.map(toSummary), error: null },
        recentReleases: { data: albumCatalog.map(toSummary), error: null },
      })
    }

    if (pathname === '/api/search' && method === 'GET') {
      const query = String(url.searchParams.get('q') ?? '').trim().toLowerCase()
      const filtered = query
        ? albumCatalog.filter((album) => {
            const artistJoined = album.artists.join(' ').toLowerCase()
            return album.name.toLowerCase().includes(query) || artistJoined.includes(query)
          })
        : []

      return json(route, {
        data: filtered.map(toSummary),
        correctedQuery: null,
      })
    }

    if (pathname.startsWith('/api/releases/') && method === 'GET') {
      const releaseId = pathname.split('/').pop() ?? ''
      const album = albumCatalog.find((entry) => entry.id === releaseId)
      if (!album) return json(route, { error: 'Unable to load release details.' }, 404)

      const rating = ratings.get(releaseId)
      const reviewSet = reviewsByAlbum.get(releaseId) ?? []
      return json(route, {
        ...album,
        communityRating: Number.isFinite(rating) ? rating : album.communityRating,
        reviewCount: reviewSet.length || album.reviewCount,
      })
    }

    if (pathname === '/api/me/ratings' && method === 'GET') {
      const payload = Object.fromEntries(
        Array.from(ratings.entries()).map(([albumId, rating]) => [albumId, { rating, timestamp: Date.now() }]),
      )
      return json(route, { data: payload })
    }

    if (pathname.startsWith('/api/me/ratings/') && method === 'PUT') {
      const albumId = pathname.split('/').pop() ?? ''
      const body = await parseBody(route)
      const value = Number(body.rating)
      const normalized = Number.isFinite(value) ? Math.max(0.5, Math.min(5, value)) : 0
      ratings.set(albumId, normalized)

      return json(route, {
        data: {
          rating: normalized,
          timestamp: Date.now(),
          communityRating: normalized,
          reviewCount: (reviewsByAlbum.get(albumId) ?? []).length,
        },
      })
    }

    if (pathname.startsWith('/api/me/ratings/') && method === 'DELETE') {
      const albumId = pathname.split('/').pop() ?? ''
      ratings.delete(albumId)
      return json(route, {
        data: {
          rating: null,
          timestamp: Date.now(),
          communityRating: 0,
          reviewCount: (reviewsByAlbum.get(albumId) ?? []).length,
        },
      })
    }

    if (pathname === '/api/me/lists' && method === 'GET') {
      return json(route, {
        data: lists,
      })
    }

    if (pathname === '/api/me/lists' && method === 'POST') {
      const body = await parseBody(route)
      const name = sanitizeListName(body.name)
      const album = body.album as { id?: string; name?: string; cover?: string; artists?: string[]; releaseYear?: number } | undefined
      if (!name) {
        return json(route, { error: 'List name is required.' }, 400)
      }

      if (lists.some((entry) => entry.name.toLowerCase() === name.toLowerCase())) {
        return json(route, { error: 'List name already exists.' }, 409)
      }

      const createdAt = Date.now()
      const nextList = {
        id: `list-${Math.random().toString(36).slice(2, 10)}`,
        name,
        albums: album?.id
          ? [
              {
                id: String(album.id),
                name: String(album.name ?? 'Untitled'),
                cover: String(album.cover ?? ''),
                artists: Array.isArray(album.artists) ? album.artists : [],
                releaseYear: Number.isFinite(Number(album.releaseYear)) ? Number(album.releaseYear) : null,
                addedAt: createdAt,
              },
            ]
          : [],
        createdAt,
        updatedAt: createdAt,
      }
      lists.unshift(nextList)

      return json(route, {
        data: {
          ...nextList,
          added: Boolean(album?.id),
        },
      })
    }

    if (/\/api\/me\/lists\/[^/]+\/toggle$/.test(pathname) && method === 'POST') {
      const listId = pathname.split('/')[4]
      const body = await parseBody(route)
      const albumId = String(body.id ?? '').trim()
      const list = lists.find((entry) => entry.id === listId)
      if (!list) {
        return json(route, { error: 'List not found.' }, 404)
      }

      const existingIndex = list.albums.findIndex((entry) => entry.id === albumId)
      const now = Date.now()

      if (existingIndex >= 0) {
        list.albums.splice(existingIndex, 1)
        list.updatedAt = now
        return json(route, {
          data: {
            added: false,
            listName: list.name,
          },
        })
      }

      list.albums.unshift({
        id: albumId,
        name: String(body.name ?? 'Untitled'),
        cover: String(body.cover ?? ''),
        artists: Array.isArray(body.artists) ? body.artists.map(String) : [],
        releaseYear: Number.isFinite(Number(body.releaseYear)) ? Number(body.releaseYear) : null,
        addedAt: now,
      })
      list.updatedAt = now

      return json(route, {
        data: {
          added: true,
          listName: list.name,
        },
      })
    }

    if (/\/api\/albums\/[^/]+\/reviews$/.test(pathname) && method === 'GET') {
      const albumId = pathname.split('/')[3]
      const reviews = reviewsByAlbum.get(albumId) ?? []
      return json(route, {
        data: reviews,
        nextCursor: null,
      })
    }

    if (pathname.startsWith('/api/me/reviews/') && method === 'PUT') {
      const albumId = pathname.split('/').pop() ?? ''
      const body = await parseBody(route)
      const content = String(body.content ?? '').trim()
      const existing = reviewsByAlbum.get(albumId) ?? []
      const created = {
        id: `review-${Math.random().toString(36).slice(2, 10)}`,
        content,
        user: {
          name: user.name,
          username: 'e2e-user',
        },
        createdAt: Date.now(),
        rating: ratings.get(albumId) ?? null,
      }
      reviewsByAlbum.set(albumId, [created, ...existing])
      return json(route, {
        data: {
          albumId,
          content,
          updatedAt: Date.now(),
        },
      })
    }

    if (pathname === '/api/me/profile' && method === 'GET') {
      const totalRated = ratings.size
      const averageRating = totalRated
        ? Number((Array.from(ratings.values()).reduce((sum, entry) => sum + entry, 0) / totalRated).toFixed(1))
        : 0
      return json(route, {
        data: {
          userId: user.id,
          username: 'e2e-user',
          name: user.name,
          bio: 'E2E profile',
          image: null,
          followerCount: 0,
          followingCount: 0,
          recentRatings: [],
          stats: {
            totalRated,
            averageRating,
          },
          joinedAt: Date.now(),
        },
      })
    }

    return json(route, {
      error: `Unhandled mock route: ${method} ${pathname}`,
    }, 500)
  })
}
