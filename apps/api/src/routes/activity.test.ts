import { expect, test } from 'bun:test'

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
    userUsername: 'e2e-user',
    userImage: null,
  }, {
    name: 'Following Target',
    username: 'target',
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
      username: 'e2e-user',
      image: null,
    },
    targetUser: {
      name: 'Following Target',
      username: 'target',
      image: 'https://images.example/target.jpg',
    },
  })
})
