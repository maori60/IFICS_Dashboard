import {
  createHash,
  randomUUID,
} from 'node:crypto'
import {
  defineEventHandler,
  type H3Event,
} from 'h3'
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
  reportId: '',
  associationId: '',

  roleCode:
    'ADMIN',

  actorIntervenorId:
    null as string | null,

  permissions:
    [] as string[],
}))

vi.mock('h3', async (importOriginal) => {
  const actual
    = await importOriginal<
      typeof import('h3')
    >()

  return {
    ...actual,

    getRouterParam: () =>
      request.reportId,
  }
})

vi.mock('../../server/utils/auth', () => ({
  requireAuth: async () => ({
    sessionId:
      'cra-client-admin-read-session',

    userId:
      'cra-client-admin-read-user',

    associationId:
      request.associationId,

    clientId:
      null,

    intervenorId:
      request.actorIntervenorId,

    email:
      'admin@example.invalid',

    firstName:
      'Admin',

    lastName:
      'CRA',

    roleCode:
      request.roleCode,

    roleName:
      request.roleCode,

    permissions:
      request.permissions,

    mfaEnabled:
      true,

    mfaVerified:
      true,

    mfaSetupRequired:
      false,
  }),

  hasPermission: (
    context: {
      permissions: string[]
    },
    permission: string,
  ) =>
    context.permissions.includes('*')
    || context.permissions.includes(
      permission,
    ),
}))

describe.skipIf(
  process.env.CRA_INTEGRATION_TESTS !== '1',
)(
  'Lecture admin de la publication CRA client avec PostgreSQL',
  () => {
    let prisma:
      typeof import(
        '../../server/utils/prisma'
      )['prisma']

    let handler:
      typeof import(
        '../../server/api/cra/[id]/index.get'
      )['default']

    let reportId: string
    let intervenorId: string
    let documentId: string

    const event = {} as H3Event

    const associationId
      = `cra-client-admin-read-${randomUUID()}`

    const clientEmail
      = 'client.general@example.invalid'

    const contactEmail
      = 'responsable.client@example.invalid'

    const accessCreatedAt
      = new Date(
        '2026-09-20T09:00:00.000Z',
      )

    const emailSentAt
      = new Date(
        '2026-09-20T09:01:00.000Z',
      )

    const firstViewedAt
      = new Date(
        '2026-09-20T09:15:00.000Z',
      )

    const downloadedAt
      = new Date(
        '2026-09-20T09:20:00.000Z',
      )

    const expiresAt
      = new Date(
        '2099-09-27T09:01:00.000Z',
      )

    async function cleanup() {
      if (
        !associationId.startsWith(
          'cra-client-admin-read-',
        )
      ) {
        throw new Error(
          'Refus du nettoyage : association de test invalide.',
        )
      }

      const reports
        = await prisma.craReport.findMany({
          where: {
            associationId,
          },

          select: {
            id: true,
          },
        })

      const reportIds
        = reports.map(
          report => report.id,
        )

      if (reportIds.length > 0) {
        await prisma.craClientAccess
          .deleteMany({
            where: {
              reportId: {
                in: reportIds,
              },
            },
          })

        await prisma.craDocument
          .deleteMany({
            where: {
              reportId: {
                in: reportIds,
              },
            },
          })

        await prisma.craReport
          .deleteMany({
            where: {
              associationId,
            },
          })
      }

      await prisma.projectIntervenor
        .deleteMany({
          where: {
            project: {
              associationId,
            },
          },
        })

      await prisma.projectClient
        .deleteMany({
          where: {
            project: {
              associationId,
            },
          },
        })

      await prisma.project
        .deleteMany({
          where: {
            associationId,
          },
        })

      await prisma.client
        .deleteMany({
          where: {
            associationId,
          },
        })

      await prisma.intervenor
        .deleteMany({
          where: {
            associationId,
          },
        })

      await prisma.association
        .deleteMany({
          where: {
            id:
              associationId,
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

      handler = (
        await import(
          '../../server/api/cra/[id]/index.get'
        )
      ).default

      await prisma.association.create({
        data: {
          id:
            associationId,

          name:
            'IFICS test lecture publication client',
        },
      })

      const intervenor
        = await prisma.intervenor.create({
          data: {
            associationId,

            firstName:
              'Jean',

            lastName:
              'Intervenant',

            email:
              `${associationId}@example.invalid`,

            status:
              'ACTIVE',
          },
        })

      intervenorId
        = intervenor.id

      const client
        = await prisma.client.create({
          data: {
            associationId,

            type:
              'AUTRE',

            status:
              'ACTIVE',

            name:
              'Client publication CRA',

            email:
              clientEmail,

            addressLine1:
              '1 rue du Test',

            postalCode:
              '75000',

            city:
              'Paris',

            country:
              'France',

            contacts: {
              create: {
                firstName:
                  'Alice',

                lastName:
                  'Responsable',

                email:
                  contactEmail,

                jobTitle:
                  'Responsable',

                isPrimary:
                  true,
              },
            },
          },
        })

      const project
        = await prisma.project.create({
          data: {
            associationId,

            reference:
              'MISSION-CLIENT-READ',

            title:
              'Mission lecture publication CRA',

            status:
              'IN_PROGRESS',

            classification:
              'INTERNAL',

            projectIntervenors: {
              create: {
                intervenorId,

                assignmentStatus:
                  'ACCEPTED',
              },
            },

            projectClients: {
              create: {
                clientId:
                  client.id,

                isMainClient:
                  true,
              },
            },
          },
        })

      const report
        = await prisma.craReport.create({
          data: {
            associationId,

            projectId:
              project.id,

            intervenorId,

            year:
              2026,

            month:
              9,

            status:
              'REVIEWED',

            revision:
              4,

            reviewedAt:
              new Date(),
          },
        })

      reportId
        = report.id

      const document
        = await prisma.craDocument.create({
          data: {
            reportId,

            type:
              'INTERVENOR_SIGNED',

            status:
              'APPROVED',

            version:
              1,

            reportRevision:
              4,

            reference:
              'CRA-CLIENT-READ-SIGNED-V1',

            originalName:
              'CRA-client-read-signed-v1.pdf',

            storedName:
              'signed-v1.pdf',

            filePath:
              `cra/${reportId}/signed-v1.pdf`,

            mimeType:
              'application/pdf',

            fileSize:
              BigInt(1234),

            sha256:
              'a'.repeat(64),

            antivirusStatus:
              'CLEAN',

            antivirusCheckedAt:
              new Date(),

            antivirusResult:
              'stream: OK',

            receivedAt:
              new Date(),

            reviewedAt:
              new Date(),
          },
        })

      documentId
        = document.id

      await prisma.craClientAccess.create({
        data: {
          reportId,
          documentId,

          purpose:
            'INITIAL_CONFIRMATION',

          status:
            'ACTIVE',

          tokenHash:
            createHash('sha256')
              .update(
                randomUUID(),
              )
              .digest('hex'),

          recipientEmail:
            contactEmail,

          createdByUserId:
            null,

          expiresAt,
          firstViewedAt,
          downloadedAt,
          emailSentAt,
          createdAt:
            accessCreatedAt,
        },
      })
    })

    beforeEach(() => {
      request.reportId
        = reportId

      request.associationId
        = associationId

      request.roleCode
        = 'ADMIN'

      request.actorIntervenorId
        = null

      request.permissions = [
        'cra:read:all',
        'cra:send:client',
      ]
    })

    afterAll(async () => {
      try {
        if (prisma) {
          await cleanup()
        }
      }
      finally {
        vi.unstubAllGlobals()

        if (prisma) {
          await prisma.$disconnect()
        }
      }
    })

    it(
      'expose uniquement les destinataires autorisés et les métadonnées publiques de publication',
      async () => {
        const response
          = await handler(event)

        expect(
          response.data.clientRecipients,
        ).toHaveLength(2)

        expect(
          response.data.clientRecipients,
        ).toEqual(
          expect.arrayContaining([
            {
              email:
                clientEmail,

              clientName:
                'Client publication CRA',

              contactFirstName:
                null,

              contactLastName:
                null,

              isPrimary:
                false,
            },
            {
              email:
                contactEmail,

              clientName:
                'Client publication CRA',

              contactFirstName:
                'Alice',

              contactLastName:
                'Responsable',

              isPrimary:
                true,
            },
          ]),
        )

        expect(
          response.data.clientPublication,
        ).toEqual({
          purpose:
            'INITIAL_CONFIRMATION',

          status:
            'ACTIVE',

          recipientEmail:
            contactEmail,

          expiresAt:
            expiresAt.toISOString(),

          firstViewedAt:
            firstViewedAt.toISOString(),

          downloadedAt:
            downloadedAt.toISOString(),

          confirmedAt:
            null,

          completedAt:
            null,

          revokedAt:
            null,

          emailSentAt:
            emailSentAt.toISOString(),

          createdAt:
            accessCreatedAt.toISOString(),
        })

        expect(
          response.data.clientPublication,
        ).not.toHaveProperty(
          'tokenHash',
        )

        expect(
          response.data.clientPublication,
        ).not.toHaveProperty(
          'emailMessageId',
        )

        expect(
          response.data.clientPublication,
        ).not.toHaveProperty(
          'id',
        )
      },
    )

    it(
      'masque les informations client sans CRA_SEND_CLIENT',
      async () => {
        request.permissions = [
          'cra:read:all',
        ]

        const response
          = await handler(event)

        expect(
          response.data.clientRecipients,
        ).toEqual([])

        expect(
          response.data.clientPublication,
        ).toBeNull()
      },
    )

    it(
      'ne révèle aucune information client à l’intervenant',
      async () => {
        request.roleCode
          = 'INTERVENOR'

        request.actorIntervenorId
          = intervenorId

        request.permissions = [
          'cra:read:own',
        ]

        const response
          = await handler(event)

        expect(
          response.data.clientRecipients,
        ).toEqual([])

        expect(
          response.data.clientPublication,
        ).toBeNull()

        expect(
          response.data.intervenor.email,
        ).toBeNull()
      },
    )
  },
)
