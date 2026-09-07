import 'dotenv/config'
import { defineConfig } from 'prisma/config'

const DATABASE_URL = process.env.DATABASE_URL
const SHADOW_DATABASE_URL = process.env.SHADOW_DATABASE_URL

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is missing. Copy .env.example to .env and configure it.')
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: DATABASE_URL,
    ...(SHADOW_DATABASE_URL ? { shadowDatabaseUrl: SHADOW_DATABASE_URL } : {}),
  },
})
