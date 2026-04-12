import 'dotenv/config'
import { PrismaClient } from '../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
})

const prisma = new PrismaClient({ adapter })

async function main() {
  const association = await prisma.association.create({
    data: {
      name: 'Association Test IFICS',
      legalName: 'Association Test IFICS',
      billingEmail: 'contact@test-ifics.fr',
      billingCountry: 'France',
    },
  })

  console.log('Association créée :', association)
}

main()
  .catch((error) => {
    console.error('Erreur seed :', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })