import 'dotenv/config'
import { PrismaClient } from '../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is missing')
}

const adapter = new PrismaPg({
  connectionString,
})

const prisma = new PrismaClient({ adapter })

const DEFAULT_ASSOCIATION_ID = 'assoc_default_ifics'

async function main() {
  const association = await prisma.association.upsert({
    where: {
      id: DEFAULT_ASSOCIATION_ID,
    },
    update: {
      name: 'Association Test IFICS',
      legalName: 'Association Test IFICS',
      billingEmail: 'contact@test-ifics.fr',
      billingCountry: 'France',
    },
    create: {
      id: DEFAULT_ASSOCIATION_ID,
      name: 'Association Test IFICS',
      legalName: 'Association Test IFICS',
      billingEmail: 'contact@test-ifics.fr',
      billingCountry: 'France',
    },
  })

  console.log('Association prête :', association)
}

main()
  .catch((error) => {
    console.error('Erreur seed :', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })