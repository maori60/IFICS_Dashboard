import 'dotenv/config'
import { defineConfig } from 'prisma/config'

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://van_dashboard:van1234@db:5432/association_dashboard?schema=public'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: DATABASE_URL,
  },
})