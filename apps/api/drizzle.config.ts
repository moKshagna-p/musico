import { defineConfig } from 'drizzle-kit'

import { env } from './src/core/env'

export default defineConfig({
  out: './drizzle',
  schema: './src/core/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: env.DATABASE_URL,
  },
})
