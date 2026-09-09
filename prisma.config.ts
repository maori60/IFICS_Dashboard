import 'dotenv/config'
import { defineConfig } from 'prisma/config'

const DATABASE_URL = process.env.DATABASE_URL
const SHADOW_DATABASE_URL = process.env.SHADOW_DATABASE_URL

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is missing. Copy .env.example to .env and configure it.')
}

export default defineConfig({
  // Prisma 7 supports schema folders. Core historical models remain in
  // prisma/schema.prisma while new bounded modules can live in dedicated
  // *.prisma files without growing one unmaintainable schema file.
  schema: 'prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: DATABASE_URL,
    ...(SHADOW_DATABASE_URL ? { shadowDatabaseUrl: SHADOW_DATABASE_URL } : {}),
  },
})