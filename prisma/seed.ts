import 'dotenv/config'
import { PrismaClient } from '../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { DEFAULT_ASSOCIATION_ID, SYSTEM_ROLES } from '../server/utils/constants'
import { hashPassword, validatePasswordPolicy } from '../server/utils/security'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is missing')
}

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

function configuredAdmin(): { email: string; password: string; firstName: string; lastName: string } | null {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD || ''

  if (!email || !password || email.endsWith('.invalid') || password.startsWith('CHANGE_ME')) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be configured with non-placeholder values before the production seed is run.')
    }

    return null
  }

  validatePasswordPolicy(password, 16)

  return {
    email,
    password,
    firstName: process.env.ADMIN_FIRST_NAME?.trim() || 'Administrateur',
    lastName: process.env.ADMIN_LAST_NAME?.trim() || 'IFICS',
  }
}

async function main() {
  const association = await prisma.association.upsert({
    where: { id: DEFAULT_ASSOCIATION_ID },
    update: {},
    create: {
      id: DEFAULT_ASSOCIATION_ID,
      name: 'IFICS',
      legalName: 'IFICS',
      billingCountry: 'France',
      timezone: 'Europe/Paris',
      locale: 'fr-FR',
      currency: 'EUR',
    },
  })

  const roleIds = new Map<string, string>()

  for (const [code, definition] of Object.entries(SYSTEM_ROLES)) {
    const role = await prisma.role.upsert({
      where: {
        associationId_code: {
          associationId: association.id,
          code,
        },
      },
      update: {
        name: definition.name,
        description: definition.description,
        permissions: definition.permissions,
        isSystemRole: true,
      },
      create: {
        associationId: association.id,
        code,
        name: definition.name,
        description: definition.description,
        permissions: definition.permissions,
        isSystemRole: true,
      },
    })

    roleIds.set(code, role.id)
  }

  const admin = configuredAdmin()

  if (admin) {
    const roleId = roleIds.get('ADMIN')

    if (!roleId) {
      throw new Error('ADMIN system role was not created.')
    }

    const existing = await prisma.user.findUnique({
      where: { email: admin.email },
      select: { id: true },
    })

    if (!existing) {
      const passwordHash = await hashPassword(admin.password)

      await prisma.user.create({
        data: {
          associationId: association.id,
          roleId,
          firstName: admin.firstName,
          lastName: admin.lastName,
          email: admin.email,
          passwordHash,
          status: 'ACTIVE',
        },
      })

      console.log(`Administrateur initial créé : ${admin.email}`)
    }
    else {
      console.log(`Administrateur déjà présent : ${admin.email}`)
    }
  }
  else {
    console.log('Aucun compte administrateur bootstrap créé (variables ADMIN_* non configurées).')
  }

  console.log(`Association prête : ${association.name} (${association.id})`)
  console.log(`Rôles système synchronisés : ${roleIds.size}`)
}

main()
  .catch((error) => {
    console.error('Erreur seed :', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
