import { relations } from 'drizzle-orm'

import { account, authSchema, session, user } from './schema'

// Relations let Better Auth's `experimental.joins` read session + user in one query.
const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}))

const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}))

const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}))

export const dbSchema = { ...authSchema, userRelations, sessionRelations, accountRelations }
