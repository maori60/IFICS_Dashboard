import { randomUUID } from 'node:crypto'
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

const browser = vi.hoisted(() => ({
  cookie: undefined as string | undefined,
  deleteCookie: vi.fn(),
  setResponseHeader: vi.fn(),
}))

const auditBehavior = vi.hoisted(() => ({
  failStrict: false,
}))

vi.mock(
  '../../server/utils/audit',
  async (importOriginal) => {
    const actual = await importOriginal<
      typeof import('../../server/utils/audit')
    >()

    return {
      ...actual,

      writeAuditLogStrict:
        async (
          ...args: Parameters<
            typeof actual.writeAuditLogStrict
          >
        ) => {
          if (auditBehavior.failStrict) {
            throw new Error(
              'AUDIT_STRICT_TEST_FAILURE',
            )
          }

          return actual.writeAuditLogStrict(
            ...args,
          )
        },
    }
  },
)

vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('h3')
  >()

  return {
    ...actual,

    getCookie: () =>
      browser.cookie,

    deleteCookie:
      browser.deleteCookie,

    setResponseHeader:
      browser.setResponseHeader,

    getRequestHeader: () =>
      undefined,

    getRequestIP: () =>
      undefined,
  }
})

describe.skipIf(
  process.env.CRA_INTEGRATION_TESTS !== '1',
)(
  'Confirmation sécurisée du CRA client avec PostgreSQL',
  () => {
    let prisma:
      typeof import(
        '../../server/utils/prisma'
      )['prisma']

    let hashToken:
      typeof import(
        '../../server/utils/security'
      )['hashToken']

    let handler:
      typeof import(
        '../../server/api/cra-client/confirm.post'
      )['default']

    const event = {
      context: {},
    } as H3Event

    const associationId
      = `cra-client-confirm-${randomUUID()}`

    let intervenorId: string
    let projectId: string
    let reportId: string
    let documentId: string
    let accessId: string

    let sessionToken: string

    async function createAccess(
      purpose:
        | 'INITIAL_CONFIRMATION'
        | 'REDOWNLOAD'
        = 'INITIAL_CONFIRMATION',
    ) {
      sessionToken
        = `session-${randomUUID()}-${randomUUID()}`

      browser.cookie
        = sessionToken

      const access
        = await prisma.craClientAccess.create({
          data: {
            reportId,
            documentId,

            purpose,

            status:
              'ACTIVE',

            tokenHash:
              hashToken(sessionToken),

            recipientEmail:
              'client@example.invalid',

            expiresAt:
              new Date(
                Date.now()
                + 7
                * 24
                * 60
                * 60
                * 1000,
              ),
          },
        })

      accessId
        = access.id

      return access
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

      hashToken = (
        await import(
          '../../server/utils/security'
        )
      ).hashToken

      handler = (
        await import(
          '../../server/api/cra-client/confirm.post'
        )
      ).default

      await prisma.association.create({
        data: {
          id:
            associationId,

          name:
            'IFICS test confirmation CRA client',
        },
      })

      const intervenor
        = await prisma.intervenor.create({
          data: {
            associationId,

            firstName:
              'Jean',

            lastName:
              'Confirmation',

            email:
              `${associationId}@example.invalid`,

            status:
              'ACTIVE',
          },
        })

      intervenorId
        = intervenor.id

      const project
        = await prisma.project.create({
          data: {
            associationId,

            reference:
              'MISSION-CLIENT-CONFIRM',

            title:
              'Mission confirmation CRA client',

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
          },
        })

      projectId
        = project.id

      const report
        = await prisma.craReport.create({
          data: {
            associationId,
            projectId,
            intervenorId,

            year:
              2026,

            month:
              9,

            status:
              'REVIEWED',

            revision:
              3,

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
              3,

            reference:
              `CRA-CLIENT-CONFIRM-${randomUUID()
                .replaceAll('-', '')
                .slice(0, 10)
                .toUpperCase()}`,

            originalName:
              'CRA signé client.pdf',

            storedName:
              'cra-signe-client.pdf',

            filePath:
              `cra/${reportId}/cra-signe-client.pdf`,

            mimeType:
              'application/pdf',

            fileSize:
              BigInt(100),

            sha256:
              'a'.repeat(64),

            receivedAt:
              new Date(),

            reviewedAt:
              new Date(),

            antivirusStatus:
              'CLEAN',

            antivirusCheckedAt:
              new Date(),

            antivirusResult:
              'stream: OK',
          },
        })

      documentId
        = document.id
    })

    beforeEach(async () => {
      await prisma.auditLog.deleteMany({
        where: {
          associationId,

          action:
            'CRA_CLIENT_ACCESS_CONFIRMED',
        },
      })

      await prisma.craClientAccess
        .deleteMany({
          where: {
            reportId,
          },
        })

      await prisma.craReport.update({
        where: {
          id:
            reportId,
        },

        data: {
          status:
            'REVIEWED',

          revision:
            3,
        },
      })

      await prisma.craDocument.update({
        where: {
          id:
            documentId,
        },

        data: {
          status:
            'APPROVED',

          reportRevision:
            3,

          antivirusStatus:
            'CLEAN',

          archivedAt:
            null,
        },
      })

      browser.cookie
        = undefined

      browser.deleteCookie
        .mockReset()

      browser.setResponseHeader
        .mockReset()

      auditBehavior.failStrict = false

      await createAccess()
    })

    afterAll(async () => {
      try {
        if (prisma) {
          if (
            !associationId.startsWith(
              'cra-client-confirm-',
            )
          ) {
            throw new Error(
              'Refus du nettoyage : association de test invalide.',
            )
          }

          const testReports
            = await prisma.craReport.findMany({
              where: {
                associationId,
              },

              select: {
                id: true,
              },
            })

          const testReportIds
            = testReports.map(
              report => report.id,
            )

          await prisma.auditLog.deleteMany({
            where: {
              associationId,
            },
          })

          if (testReportIds.length > 0) {
            await prisma.craClientAccess
              .deleteMany({
                where: {
                  reportId: {
                    in:
                      testReportIds,
                  },
                },
              })

            await prisma.craDocument
              .deleteMany({
                where: {
                  reportId: {
                    in:
                      testReportIds,
                  },
                },
              })
          }

          await prisma.craReport
            .deleteMany({
              where: {
                associationId,
              },
            })

          await prisma.projectIntervenor
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
      }
      finally {
        vi.unstubAllGlobals()

        if (prisma) {
          await prisma.$disconnect()
        }
      }
    })

    it(
      'confirme le CRA, termine l’accès et écrit l’audit',
      async () => {
        const result
          = await handler(event)

        expect(result.data.confirmed)
          .toBe(true)

        expect(result.data.completedAt)
          .toBeInstanceOf(Date)

        const access
          = await prisma.craClientAccess
            .findUniqueOrThrow({
              where: {
                id:
                  accessId,
              },
            })

        expect(access.status)
          .toBe('COMPLETED')

        expect(access.confirmedAt)
          .not.toBeNull()

        expect(access.completedAt)
          .not.toBeNull()

        expect(
          access.confirmedAt?.getTime(),
        ).toBe(
          access.completedAt?.getTime(),
        )

        expect(
          browser.deleteCookie,
        ).toHaveBeenCalledWith(
          event,
          'ifics_cra_client_access',
          {
            path:
              '/api/cra-client',
          },
        )

        const audits
          = await prisma.auditLog.findMany({
            where: {
              associationId,

              action:
                'CRA_CLIENT_ACCESS_CONFIRMED',

              entityType:
                'CraClientAccess',

              entityId:
                accessId,
            },
          })

        expect(audits)
          .toHaveLength(1)

        expect(audits[0]?.outcome)
          .toBe('SUCCESS')

        const metadata
          = audits[0]?.metadata as
            Record<string, unknown>

        expect(metadata.confirmedAt)
          .toBe(
            access.confirmedAt
              ?.toISOString(),
          )

        expect(metadata.completedAt)
          .toBe(
            access.completedAt
              ?.toISOString(),
          )

        expect(metadata.confirmedAt)
          .toBe(
            metadata.completedAt,
          )
      },
    )

    it(
      'annule entièrement la confirmation si l’audit strict échoue',
      async () => {
        auditBehavior.failStrict = true

        await expect(
          handler(event),
        ).rejects.toThrow(
          'AUDIT_STRICT_TEST_FAILURE',
        )

        const access
          = await prisma.craClientAccess
            .findUniqueOrThrow({
              where: {
                id:
                  accessId,
              },
            })

        expect(access.status)
          .toBe('ACTIVE')

        expect(access.confirmedAt)
          .toBeNull()

        expect(access.completedAt)
          .toBeNull()

        expect(
          browser.deleteCookie,
        ).not.toHaveBeenCalled()

        const auditCount
          = await prisma.auditLog.count({
            where: {
              associationId,

              action:
                'CRA_CLIENT_ACCESS_CONFIRMED',

              entityId:
                accessId,
            },
          })

        expect(auditCount)
          .toBe(0)
      },
    )

    it(
      'rend la même session inutilisable après confirmation',
      async () => {
        await handler(event)

        /*
         * Le navigateur aurait supprimé le cookie,
         * mais on le remet volontairement pour vérifier
         * que le secret lui-même ne donne plus accès.
         */
        browser.cookie
          = sessionToken

        await expect(
          handler(event),
        ).rejects.toMatchObject({
          statusCode:
            410,

          data: {
            code:
              'CRA_CLIENT_ACCESS_INVALID',
          },
        })

        const access
          = await prisma.craClientAccess
            .findUniqueOrThrow({
              where: {
                id:
                  accessId,
              },
            })

        expect(access.status)
          .toBe('COMPLETED')
      },
    )

    it(
      'refuse la confirmation depuis un accès REDOWNLOAD',
      async () => {
        await prisma.craClientAccess
          .deleteMany({
            where: {
              reportId,
            },
          })

        await createAccess(
          'REDOWNLOAD',
        )

        await expect(
          handler(event),
        ).rejects.toMatchObject({
          statusCode:
            403,

          data: {
            code:
              'CRA_CLIENT_CONFIRMATION_FORBIDDEN',
          },
        })

        const access
          = await prisma.craClientAccess
            .findUniqueOrThrow({
              where: {
                id:
                  accessId,
              },
            })

        expect(access.status)
          .toBe('ACTIVE')

        expect(access.confirmedAt)
          .toBeNull()

        expect(access.completedAt)
          .toBeNull()

        expect(
          browser.deleteCookie,
        ).not.toHaveBeenCalled()

        const auditCount
          = await prisma.auditLog.count({
            where: {
              associationId,

              action:
                'CRA_CLIENT_ACCESS_CONFIRMED',

              entityId:
                accessId,
            },
          })

        expect(auditCount)
          .toBe(0)
      },
    )

    it(
      'refuse sans cookie de session',
      async () => {
        browser.cookie
          = undefined

        await expect(
          handler(event),
        ).rejects.toMatchObject({
          statusCode:
            401,

          data: {
            code:
              'CRA_CLIENT_SESSION_REQUIRED',
          },
        })

        const access
          = await prisma.craClientAccess
            .findUniqueOrThrow({
              where: {
                id:
                  accessId,
              },
            })

        expect(access.status)
          .toBe('ACTIVE')
      },
    )

    it(
      'refuse si le document n’est plus approuvé',
      async () => {
        await prisma.craDocument.update({
          where: {
            id:
              documentId,
          },

          data: {
            status:
              'REJECTED',
          },
        })

        await expect(
          handler(event),
        ).rejects.toMatchObject({
          statusCode:
            410,

          data: {
            code:
              'CRA_CLIENT_ACCESS_INVALID',
          },
        })

        const access
          = await prisma.craClientAccess
            .findUniqueOrThrow({
              where: {
                id:
                  accessId,
              },
            })

        expect(access.status)
          .toBe('ACTIVE')

        expect(access.confirmedAt)
          .toBeNull()
      },
    )
  },
)
