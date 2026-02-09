import { defineConfig } from 'drizzle-kit'

const env = ((globalThis as unknown as { Bun?: { env: Record<string, string | undefined> } }).Bun?.env ??
  process.env ??
  {}) as Record<string, string | undefined>

const databaseUrl = env.DATABASE_URL?.trim()

if (!databaseUrl) {
  throw new Error('Missing DATABASE_URL environment variable for Drizzle config.')
}

export default defineConfig({
  out: './drizzle',
  schema: './schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
})

