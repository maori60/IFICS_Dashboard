import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'
import {
  DEFAULT_ASSOCIATION_ID,
  PERMISSIONS,
  ROLE_CODES,
} from '../server/utils/constants'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL est manquante.')
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
})

async function main() {
  const result = await prisma.$transaction(async (tx) => {
    const role = await tx.role.findUniqueOrThrow({
      where: {
        associationId_code: {
          associationId: DEFAULT_ASSOCIATION_ID,
          code: ROLE_CODES.INTERVENOR,
        },
      },
      select: {
        id: true,
        permissions: true,
      },
    })

    const requiredPermissions = [
      PERMISSIONS.CRA_READ_OWN,
      PERMISSIONS.CRA_WRITE_OWN,
    ]

    const added = requiredPermissions.filter(
      permission => !role.permissions.includes(permission),
    )

    if (added.length > 0) {
      await tx.role.update({
        where: { id: role.id },
        data: {
          permissions: [...role.permissions, ...added],
        },
      })
    }

    return { added }
  }, {
    isolationLevel: 'Serializable',
  })

  if (result.added.length === 0) {
    console.log('Le rôle Intervenant possède déjà les permissions CRA.')
  }
  else {
    console.log(`Permissions ajoutées : ${result.added.join(', ')}`)
  }

  console.log(`Association : ${DEFAULT_ASSOCIATION_ID}`)
}

main()
  .catch((error) => {
    console.error('Échec de la mise à jour des permissions CRA :', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })