import type { ReleaseSummary } from './types'

import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

export const user = pgTable(
  'user',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    emailVerified: boolean('emailVerified').notNull().default(false),
    image: text('image'),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [uniqueIndex('user_email_unique').on(table.email)],
)

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expiresAt', { withTimezone: true, mode: 'date' }).notNull(),
    token: text('token').notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).notNull(),
    ipAddress: text('ipAddress'),
    userAgent: text('userAgent'),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [uniqueIndex('session_token_unique').on(table.token), index('session_user_id_idx').on(table.userId)],
)

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('accountId').notNull(),
    providerId: text('providerId').notNull(),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('accessToken'),
    refreshToken: text('refreshToken'),
    idToken: text('idToken'),
    accessTokenExpiresAt: timestamp('accessTokenExpiresAt', { withTimezone: true, mode: 'date' }),
    refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt', { withTimezone: true, mode: 'date' }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [
    index('account_user_id_idx').on(table.userId),
    uniqueIndex('account_provider_account_unique').on(table.providerId, table.accountId),
  ],
)

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expiresAt', { withTimezone: true, mode: 'date' }).notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
)

export const featuredCache = pgTable(
  'featured_cache',
  {
    mode: text('mode').primaryKey(),
    payload: jsonb('payload').$type<ReleaseSummary[]>().notNull(),
    expiresAt: timestamp('expiresAt', { withTimezone: true, mode: 'date' }).notNull(),
    refreshedAt: timestamp('refreshedAt', { withTimezone: true, mode: 'date' }).notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [index('featured_cache_expires_at_idx').on(table.expiresAt)],
)

export const searchCache = pgTable(
  'search_cache',
  {
    queryHash: text('queryHash').primaryKey(),
    normalizedQuery: text('normalizedQuery').notNull(),
    payload: jsonb('payload').$type<ReleaseSummary[]>().notNull(),
    expiresAt: timestamp('expiresAt', { withTimezone: true, mode: 'date' }).notNull(),
    refreshedAt: timestamp('refreshedAt', { withTimezone: true, mode: 'date' }).notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [
    index('search_cache_expires_at_idx').on(table.expiresAt),
    index('search_cache_normalized_query_idx').on(table.normalizedQuery),
  ],
)

export const userRating = pgTable(
  'user_rating',
  {
    id: text('id').primaryKey(),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    albumId: text('albumId').notNull(),
    rating: integer('rating').notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [
    uniqueIndex('user_rating_user_album_unique').on(table.userId, table.albumId),
    index('user_rating_user_id_idx').on(table.userId),
  ],
)

export const userList = pgTable(
  'user_list',
  {
    id: text('id').primaryKey(),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [
    index('user_list_user_id_idx').on(table.userId),
    uniqueIndex('user_list_user_name_unique').on(table.userId, table.name),
  ],
)

export const userListAlbum = pgTable(
  'user_list_album',
  {
    id: text('id').primaryKey(),
    listId: text('listId')
      .notNull()
      .references(() => userList.id, { onDelete: 'cascade' }),
    albumId: text('albumId').notNull(),
    name: text('name').notNull(),
    cover: text('cover').notNull().default(''),
    artists: jsonb('artists').$type<string[]>().notNull(),
    releaseYear: integer('releaseYear'),
    addedAt: timestamp('addedAt', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [
    index('user_list_album_list_id_idx').on(table.listId),
    uniqueIndex('user_list_album_unique').on(table.listId, table.albumId),
  ],
)

// ── Social profile (separate table to avoid touching Better Auth's user table) ──

export const userProfile = pgTable(
  'user_profile',
  {
    userId: text('userId')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    username: text('username'),
    bio: text('bio').notNull().default(''),
    isPublic: boolean('isPublic').notNull().default(true),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [uniqueIndex('user_profile_username_unique').on(table.username)],
)

// ── Follow relationships ──

export const userFollow = pgTable(
  'user_follow',
  {
    id: text('id').primaryKey(),
    followerId: text('followerId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    followingId: text('followingId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [
    uniqueIndex('user_follow_unique').on(table.followerId, table.followingId),
    index('user_follow_follower_idx').on(table.followerId),
    index('user_follow_following_idx').on(table.followingId),
  ],
)

// ── Micro-reviews ──

export const userReview = pgTable(
  'user_review',
  {
    id: text('id').primaryKey(),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    albumId: text('albumId').notNull(),
    content: text('content').notNull(),
    albumName: text('albumName').notNull().default(''),
    albumCover: text('albumCover').notNull().default(''),
    albumArtists: jsonb('albumArtists').$type<string[]>().notNull().default([]),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [
    uniqueIndex('user_review_user_album_unique').on(table.userId, table.albumId),
    index('user_review_user_id_idx').on(table.userId),
    index('user_review_album_id_idx').on(table.albumId),
  ],
)

// ── Activity feed events ──

export const activityTypeEnum = pgEnum('activity_type', ['rated', 'reviewed', 'listed', 'followed'])

export const activity = pgTable(
  'activity',
  {
    id: text('id').primaryKey(),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    type: activityTypeEnum('type').notNull(),
    albumId: text('albumId'),
    albumName: text('albumName'),
    albumCover: text('albumCover'),
    targetUserId: text('targetUserId').references(() => user.id, { onDelete: 'set null' }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [
    index('activity_user_id_created_at_idx').on(table.userId, table.createdAt),
    index('activity_created_at_idx').on(table.createdAt),
  ],
)

export const authSchema = {
  user,
  session,
  account,
  verification,
}
