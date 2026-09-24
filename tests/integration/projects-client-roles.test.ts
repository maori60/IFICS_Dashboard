import { randomUUID } from 'node:crypto'
import { defineEventHandler } from 'h3'
import type { H3Event } from 'h3'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const request = vi.hoisted(() => ({
  associationId: '',
  projectId: '',
  body: {} as Record<string, unknown>,
}))

const writeAuditLog = vi.hoisted(
  () => vi.fn(),
)

vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('h3')
  >()

  return {
    ...actual,

    getRouterParam: () =>
      request.projectId,

    readBody: async () =>
      request.body,
  }
})

vi.mock('../../server/utils/auth', () => {
  const authContext = () => ({
    sessionId:
      'projects-client-roles-session',

    userId:
      'projects-client-roles-admin',

    associationId:
      request.associationId,

    clientId: null,
    intervenorId: null,

    email:
      'admin.projects@example.invalid',

    firstName:
      'Admin',

    lastName:
      'Projects',

    roleCode:
      'ADMIN',

    roleName:
      'Administrateur',

    permissions: [
      '*',
    ],

    mfaEnabled: true,
    mfaVerified: true,
    mfaSetupRequired: false,
  })

  return {
    requirePermission: async () =>
      authContext(),

    assertProjectAccess: async () =>
      undefined,

    hasPermission: () =>
      true,
  }
})

vi.mock('../../server/utils/audit', () => ({
  writeAuditLog,
}))

describe.skipIf(
  process.env.PROJECT_INTEGRATION_TESTS !== '1',
)(
  'Rôles clients et types des projets avec PostgreSQL',
  () => {
    let prisma:
      typeof import(
        '../../server/utils/prisma'
      )['prisma']

    let createHandler:
      typeof import(
        '../../server/api/projects/create.post'
      )['default']

    let updateHandler:
      typeof import(
        '../../server/api/projects/[id].put'
      )['default']

    let contractualClientId: string
    let endClientId: string
    let legacyClientId: string
    let inactiveClientId: string

    const event = {} as H3Event

    const associationId
      = `projects-client-roles-${randomUUID()}`

    async function cleanupProjects() {
      if (
        !associationId.startsWith(
          'projects-client-roles-',
        )
      ) {
        throw new Error(
          'Refus du nettoyage : association de test invalide.',
        )
      }

      await prisma.project.deleteMany({
        where: {
          associationId,
        },
      })
    }

    async function createClient(
      name: string,
      status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE',
    ) {
      return prisma.client.create({
        data: {
          associationId,
          type:
            'AUTRE',

          status,

          name,

          email:
            `${name
              .toLowerCase()
              .replaceAll(' ', '.')}@example.invalid`,

          addressLine1:
            '1 rue du Test',

          postalCode:
            '75000',

          city:
            'Paris',

          country:
            'France',
        },
      })
    }

    beforeAll(async () => {
      vi.stubGlobal(
        'defineEventHandler',
        defineEventHandler,
      )

      prisma = (
        await import(
          '../../server/utils/prisma'
        )
      ).prisma

      createHandler = (
        await import(
          '../../server/api/projects/create.post'
        )
      ).default

      updateHandler = (
        await import(
          '../../server/api/projects/[id].put'
        )
      ).default

      await prisma.association.create({
        data: {
          id:
            associationId,

          name:
            'IFICS test projets clients',
        },
      })

      const contractual
        = await createClient(
          'Client contractuel',
        )

      contractualClientId
        = contractual.id

      const end
        = await createClient(
          'Client final',
        )

      endClientId
        = end.id

      const legacy
        = await createClient(
          'Client historique',
        )

      legacyClientId
        = legacy.id

      const inactive
        = await createClient(
          'Client inactif',
          'INACTIVE',
        )

      inactiveClientId
        = inactive.id
    })

    beforeEach(async () => {
      await cleanupProjects()

      request.associationId
        = associationId

      request.projectId
        = ''

      request.body
        = {}

      writeAuditLog.mockReset()
    })

    afterAll(async () => {
      await cleanupProjects()

      await prisma.client.deleteMany({
        where: {
          associationId,
        },
      })

      await prisma.association.deleteMany({
        where: {
          id:
            associationId,
        },
      })
    })

    it(
      'crée une prestation commerciale avec client contractuel et client final distincts',
      async () => {
        request.body = {
          reference:
            'BUSINESS-001',

          title:
            'Mission Saint-Gobain',

          type:
            'COMMERCIAL_SERVICE',

          contractualClientId,
          endClientId,

          status:
            'IN_PROGRESS',

          classification:
            'INTERNAL',
        }

        await createHandler(event)

        const project
          = await prisma.project.findFirstOrThrow({
            where: {
              associationId,

              reference:
                'BUSINESS-001',
            },

            include: {
              projectClients: {
                orderBy: {
                  createdAt:
                    'asc',
                },
              },
            },
          })

        expect(project.type)
          .toBe('COMMERCIAL_SERVICE')

        expect(project.projectClients)
          .toHaveLength(2)

        const contractualLink
          = project.projectClients.find(
            link =>
              link.clientId
              === contractualClientId,
          )

        expect(contractualLink)
          .toMatchObject({
            isMainClient:
              false,

            isContractualClient:
              true,

            isEndClient:
              false,
          })

        const endLink
          = project.projectClients.find(
            link =>
              link.clientId
              === endClientId,
          )

        expect(endLink)
          .toMatchObject({
            isMainClient:
              true,

            isContractualClient:
              false,

            isEndClient:
              true,
          })
      },
    )

    it(
      'utilise une seule ligne ProjectClient lorsque le même client porte les deux rôles',
      async () => {
        request.body = {
          reference:
            'BUSINESS-002',

          title:
            'Mission directe',

          type:
            'COMMERCIAL_SERVICE',

          contractualClientId:
            legacyClientId,

          endClientId:
            legacyClientId,

          status:
            'IN_PROGRESS',

          classification:
            'INTERNAL',
        }

        await createHandler(event)

        const project
          = await prisma.project.findFirstOrThrow({
            where: {
              associationId,

              reference:
                'BUSINESS-002',
            },

            include: {
              projectClients:
                true,
            },
          })

        expect(project.projectClients)
          .toHaveLength(1)

        expect(project.projectClients[0])
          .toMatchObject({
            clientId:
              legacyClientId,

            isMainClient:
              true,

            isContractualClient:
              true,

            isEndClient:
              true,
          })
      },
    )

    it(
      'crée une action associative avec le client historique unique',
      async () => {
        request.body = {
          reference:
            'ASSO-001',

          title:
            'Stage PRE',

          type:
            'ASSOCIATIVE_ACTION',

          clientId:
            legacyClientId,

          status:
            'VALIDATED',

          classification:
            'INTERNAL',
        }

        await createHandler(event)

        const project
          = await prisma.project.findFirstOrThrow({
            where: {
              associationId,

              reference:
                'ASSO-001',
            },

            include: {
              projectClients:
                true,
            },
          })

        expect(project.type)
          .toBe('ASSOCIATIVE_ACTION')

        expect(project.projectClients)
          .toHaveLength(1)

        expect(project.projectClients[0])
          .toMatchObject({
            clientId:
              legacyClientId,

            isMainClient:
              true,

            isContractualClient:
              true,

            isEndClient:
              true,
          })
      },
    )

    it(
      'remplace les rôles actifs en conservant l ancien lien sans rôle',
      async () => {
        const project
          = await prisma.project.create({
            data: {
              associationId,

              reference:
                'UPDATE-001',

              title:
                'Mission à modifier',

              type:
                'COMMERCIAL_SERVICE',

              status:
                'IN_PROGRESS',

              classification:
                'INTERNAL',

              projectClients: {
                create: {
                  clientId:
                    legacyClientId,

                  isMainClient:
                    true,

                  isContractualClient:
                    true,

                  isEndClient:
                    true,
                },
              },
            },
          })

        request.projectId
          = project.id

        request.body = {
          reference:
            'UPDATE-001',

          title:
            'Mission à modifier',

          type:
            'COMMERCIAL_SERVICE',

          contractualClientId,
          endClientId,

          status:
            'IN_PROGRESS',

          classification:
            'INTERNAL',
        }

        await updateHandler(event)

        const links
          = await prisma.projectClient.findMany({
            where: {
              projectId:
                project.id,
            },

            orderBy: {
              createdAt:
                'asc',
            },
          })

        expect(links)
          .toHaveLength(3)

        expect(
          links.find(
            link =>
              link.clientId
              === legacyClientId,
          ),
        ).toMatchObject({
          isMainClient:
            false,

          isContractualClient:
            false,

          isEndClient:
            false,
        })

        expect(
          links.find(
            link =>
              link.clientId
              === contractualClientId,
          ),
        ).toMatchObject({
          isMainClient:
            false,

          isContractualClient:
            true,

          isEndClient:
            false,
        })

        expect(
          links.find(
            link =>
              link.clientId
              === endClientId,
          ),
        ).toMatchObject({
          isMainClient:
            true,

          isContractualClient:
            false,

          isEndClient:
            true,
        })
      },
    )

    it(
      'refuse un client inactif',
      async () => {
        request.body = {
          reference:
            'INVALID-CLIENT',

          title:
            'Projet client invalide',

          type:
            'COMMERCIAL_SERVICE',

          contractualClientId:
            inactiveClientId,

          endClientId,

          status:
            'DRAFT',

          classification:
            'INTERNAL',
        }

        await expect(
          createHandler(event),
        ).rejects.toMatchObject({
          statusCode:
            404,
        })

        expect(
          await prisma.project.count({
            where: {
              associationId,

              reference:
                'INVALID-CLIENT',
            },
          }),
        ).toBe(0)
      },
    )

    it(
      'refuse un type de projet invalide',
      async () => {
        request.body = {
          reference:
            'INVALID-TYPE',

          title:
            'Projet type invalide',

          type:
            'NOT_A_PROJECT_TYPE',

          contractualClientId,
          endClientId,

          status:
            'DRAFT',

          classification:
            'INTERNAL',
        }

        await expect(
          createHandler(event),
        ).rejects.toMatchObject({
          statusCode:
            400,
        })

        expect(
          await prisma.project.count({
            where: {
              associationId,

              reference:
                'INVALID-TYPE',
            },
          }),
        ).toBe(0)
      },
    )
  },
)
