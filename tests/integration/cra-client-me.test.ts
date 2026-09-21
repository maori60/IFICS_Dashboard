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
  }
})

describe.skipIf(
  process.env.CRA_INTEGRATION_TESTS !== '1',
)(
  'Session publique CRA client avec PostgreSQL',
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
        '../../server/api/cra-client/me.get'
      )['default']

    const event = {} as H3Event

    const associationId
      = `cra-client-me-${randomUUID()}`

    let intervenorId: string
    let projectId: string
    let reportId: string
    let documentId: string

    let sessionToken: string
    let accessId: string

    async function createAccess(
      options: {
        purpose?:
          | 'INITIAL_CONFIRMATION'
          | 'REDOWNLOAD'

        status?:
          | 'ACTIVE'
          | 'COMPLETED'
          | 'EXPIRED'
          | 'REVOKED'

        expiresAt?: Date
        revokedAt?: Date | null
        completedAt?: Date | null
      } = {},
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

            purpose:
              options.purpose
              ?? 'INITIAL_CONFIRMATION',

            status:
              options.status
              ?? 'ACTIVE',

            tokenHash:
              hashToken(sessionToken),

            recipientEmail:
              'client@example.invalid',

            expiresAt:
              options.expiresAt
              ?? new Date(
                Date.now()
                + 7
                * 24
                * 60
                * 60
                * 1000,
              ),

            revokedAt:
              options.revokedAt
              ?? null,

            completedAt:
              options.completedAt
              ?? null,
          },
        })

      accessId = access.id

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
          '../../server/api/cra-client/me.get'
        )
      ).default

      await prisma.association.create({
        data: {
          id:
            associationId,

          name:
            'IFICS test session CRA client',
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

      const project
        = await prisma.project.create({
          data: {
            associationId,

            reference:
              'MISSION-CLIENT-ME',

            title:
              'Mission consultation CRA client',

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
              `CRA-CLIENT-ME-${randomUUID()
                .replaceAll('-', '')
                .slice(0, 12)
                .toUpperCase()}`,

            originalName:
              'cra-signe.pdf',

            storedName:
              'cra-signe.pdf',

            filePath:
              `cra/${reportId}/cra-signe.pdf`,

            mimeType:
              'application/pdf',

            fileSize:
              BigInt(59219),

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

      await createAccess()
    })

    afterAll(async () => {
      try {
        if (prisma) {
          if (
            !associationId.startsWith(
              'cra-client-me-',
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
      'retourne uniquement les métadonnées publiques autorisées',
      async () => {
        const result
          = await handler(event)

        expect(result.data)
          .toMatchObject({
            access: {
              purpose:
                'INITIAL_CONFIRMATION',

              canViewDocument:
                true,

              canDownloadDocument:
                true,

              canConfirm:
                true,
            },

            report: {
              year:
                2026,

              month:
                9,

              project: {
                reference:
                  'MISSION-CLIENT-ME',

                title:
                  'Mission consultation CRA client',
              },

              intervenor: {
                firstName:
                  'Jean',

                lastName:
                  'Intervenant',
              },
            },

            document: {
              status:
                'APPROVED',

              originalName:
                'cra-signe.pdf',

              mimeType:
                'application/pdf',

              fileSize:
                '59219',
            },
          })

        const json
          = JSON.stringify(
            result.data,
          )

        expect(json)
          .not.toContain(
            sessionToken,
          )

        expect(json)
          .not.toContain(
            'client@example.invalid',
          )

        expect(json)
          .not.toContain(
            reportId,
          )

        expect(json)
          .not.toContain(
            documentId,
          )

        expect(json)
          .not.toContain(
            'a'.repeat(64),
          )

        expect(
          browser.setResponseHeader,
        ).toHaveBeenCalledWith(
          event,
          'Cache-Control',
          'no-store',
        )
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
      },
    )

    it(
      'refuse un cookie inconnu et le supprime',
      async () => {
        browser.cookie
          = `unknown-${randomUUID()}`

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
      },
    )

    it(
      'marque expiré un accès arrivé à expiration',
      async () => {
        await prisma.craClientAccess
          .deleteMany({
            where: {
              reportId,
            },
          })

        await createAccess({
          expiresAt:
            new Date(
              Date.now()
              - 1000,
            ),
        })

        await expect(
          handler(event),
        ).rejects.toMatchObject({
          statusCode:
            410,
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
          .toBe('EXPIRED')

        expect(
          browser.deleteCookie,
        ).toHaveBeenCalled()
      },
    )

    it(
      'refuse un accès révoqué',
      async () => {
        await prisma.craClientAccess
          .deleteMany({
            where: {
              reportId,
            },
          })

        await createAccess({
          status:
            'REVOKED',

          revokedAt:
            new Date(),
        })

        await expect(
          handler(event),
        ).rejects.toMatchObject({
          statusCode:
            410,
        })
      },
    )

    it(
      'refuse si le document n’est plus APPROVED et CLEAN',
      async () => {
        await prisma.craDocument.update({
          where: {
            id:
              documentId,
          },

          data: {
            antivirusStatus:
              'PENDING',
          },
        })

        await expect(
          handler(event),
        ).rejects.toMatchObject({
          statusCode:
            410,
        })
      },
    )

    it(
      'refuse si la révision du document ne correspond plus au CRA',
      async () => {
        await prisma.craReport.update({
          where: {
            id:
              reportId,
          },

          data: {
            revision:
              4,
          },
        })

        await expect(
          handler(event),
        ).rejects.toMatchObject({
          statusCode:
            410,
        })
      },
    )

    it(
      'autorise REDOWNLOAD sans droit de confirmation',
      async () => {
        await prisma.craClientAccess
          .deleteMany({
            where: {
              reportId,
            },
          })

        await createAccess({
          purpose:
            'REDOWNLOAD',
        })

        const result
          = await handler(event)

        expect(result.data.access)
          .toMatchObject({
            purpose:
              'REDOWNLOAD',

            canViewDocument:
              true,

            canDownloadDocument:
              true,

            canConfirm:
              false,
          })
      },
    )
  },
)
