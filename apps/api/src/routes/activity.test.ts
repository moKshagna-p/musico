import { expect, test } from 'bun:test'

Bun.env.DISCOGS_MIN_REQUEST_INTERVAL_MS = '1'
Bun.env.DISCOGS_MAX_RETRIES = '1'
Bun.env.DISCOGS_REQUEST_TIMEOUT_MS = '10'

const { toFeedItem } = await import('./activity')

test('maps feed actors and targets into the shape consumed by activity cards', () => {
  const createdAt = new Date('2026-08-18T00:00:00.000Z')

  expect(toFeedItem({
    id: 'activity-1',
    userId: 'user-1',
    type: 'rated',
    albumId: 'm:1001',
    albumName: 'Discovery',
    albumCover: 'https://images.example/discovery.jpg',
    targetUserId: null,
    metadata: { rating: 5 },
    createdAt,
    userName: 'E2E User',
    userImage: null,
  }, {
    name: 'Following Target',
    image: 'https://images.example/target.jpg',
  })).toEqual({
    id: 'activity-1',
    userId: 'user-1',
    type: 'rated',
    albumId: 'm:1001',
    albumName: 'Discovery',
    albumCover: 'https://images.example/discovery.jpg',
    targetUserId: null,
    metadata: { rating: 5 },
    createdAt: createdAt.getTime(),
    user: {
      name: 'E2E User',
      image: null,
    },
    targetUser: {
      name: 'Following Target',
      image: 'https://images.example/target.jpg',
    },
  })
})
