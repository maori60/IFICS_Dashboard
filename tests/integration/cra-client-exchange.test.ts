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

const request = vi.hoisted(() => ({
  body: {} as Record<string, unknown>,
}))

const cookie = vi.hoisted(() => ({
  set: vi.fn(),
}))

const responseHeader = vi.hoisted(() => ({
  set: vi.fn(),
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

    readBody: async () =>
      request.body,

    setCookie:
      cookie.set,

    setResponseHeader:
      responseHeader.set,
  }
})

vi.mock('../../server/utils/audit', () => ({
  writeAuditLog,
}))

describe.skipIf(
  process.env.CRA_INTEGRATION_TESTS !== '1',
)(
  'Échange sécurisé du lien CRA client avec PostgreSQL',
  () => {
    let prisma:
      typeof import(
        '../../server/utils/prisma'
      )['prisma']

    let handler:
      typeof import(
        '../../server/api/cra-client/exchange.post'
      )['default']

    let hashToken:
      typeof import(
        '../../server/utils/security'
      )['hashToken']

    const event = {} as H3Event

    const associationId
      = `cra-exchange-${randomUUID()}`

    let intervenorId: string
    let projectId: string
    let reportId: string
    let documentId: string

    let emailedToken: string
    let accessId: string

    async function createAccess(
      overrides: {
        purpose?:
          | 'INITIAL_CONFIRMATION'
          | 'REDOWNLOAD'

        documentId?: string

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
      emailedToken
        = `token-${randomUUID()}-${randomUUID()}`

      const access
        = await prisma.craClientAccess.create({
          data: {
            reportId,

            documentId:
              overrides.documentId
              ?? documentId,

            purpose:
              overrides.purpose
              ?? 'INITIAL_CONFIRMATION',

            status:
              overrides.status
              ?? 'ACTIVE',

            tokenHash:
              hashToken(
                emailedToken,
              ),

            recipientEmail:
              'client@example.invalid',

            createdByUserId:
              'cra-exchange-admin',

            expiresAt:
              overrides.expiresAt
              ?? new Date(
                Date.now()
                + 7
                * 24
                * 60
                * 60
                * 1000,
              ),

            revokedAt:
              overrides.revokedAt
              ?? null,

            completedAt:
              overrides.completedAt
              ?? null,

            emailSentAt:
              new Date(),
          },
        })

      accessId = access.id

      request.body = {
        token:
          emailedToken,
      }

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
          '../../server/api/cra-client/exchange.post'
        )
      ).default

      await prisma.association.create({
        data: {
          id:
            associationId,

          name:
            'IFICS test accès CRA client',
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
              'MISSION-EXCHANGE',

            title:
              'Mission échange CRA client',

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

      projectId = project.id

      const report
        = await prisma.craReport.create({
          data: {
            associationId,
            projectId,
            intervenorId,

            year: 2026,
            month: 9,

            status:
              'REVIEWED',

            revision: 1,

            reviewedAt:
              new Date(),

            reviewedById:
              'cra-exchange-admin',
          },
        })

      reportId = report.id

      const document
        = await prisma.craDocument.create({
          data: {
            reportId,

            type:
              'INTERVENOR_SIGNED',

            status:
              'APPROVED',

            version: 1,

            reportRevision: 1,

            reference:
              `CRA-EXCHANGE-${randomUUID()
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
              BigInt(123),

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

      documentId = document.id
    })

    beforeEach(async () => {
      await prisma.craClientAccess
        .deleteMany({
          where: {
            reportId,
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
            1,

          antivirusStatus:
            'CLEAN',

          archivedAt:
            null,
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
            1,
        },
      })

      cookie.set.mockReset()
      responseHeader.set.mockReset()
      writeAuditLog.mockReset()

      await createAccess()
    })

    afterAll(async () => {
      try {
        if (prisma) {
          /*
           * Sécurité critique :
           * le nettoyage ne doit JAMAIS dépendre d'identifiants
           * potentiellement non initialisés par beforeAll.
           *
           * Toutes les suppressions sont strictement limitées
           * à l'association aléatoire créée par ce test.
           */
          if (!associationId.startsWith('cra-exchange-')) {
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
                    in: testReportIds,
                  },
                },
              })

            await prisma.craDocument
              .deleteMany({
                where: {
                  reportId: {
                    in: testReportIds,
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
      'échange le token email contre un nouveau secret HttpOnly',
      async () => {
        const oldHash
          = hashToken(
            emailedToken,
          )

        const result
          = await handler(event)

        expect(result.data)
          .toMatchObject({
            exchanged: true,

            purpose:
              'INITIAL_CONFIRMATION',
          })

        expect(cookie.set)
          .toHaveBeenCalledTimes(1)

        const [
          cookieEvent,
          cookieName,
          cookieToken,
          options,
        ] = cookie.set.mock.calls[0]!

        expect(cookieEvent)
          .toBe(event)

        expect(cookieName)
          .toBe(
            'ifics_cra_client_access',
          )

        expect(
          typeof cookieToken,
        ).toBe('string')

        expect(cookieToken)
          .not.toBe(emailedToken)

        expect(options)
          .toMatchObject({
            httpOnly: true,
            sameSite: 'strict',

            path:
              '/api/cra-client',
          })

        const stored
          = await prisma.craClientAccess
            .findUniqueOrThrow({
              where: {
                id:
                  accessId,
              },
            })

        expect(stored.tokenHash)
          .toBe(
            hashToken(
              cookieToken,
            ),
          )

        expect(stored.tokenHash)
          .not.toBe(oldHash)

        expect(stored.firstViewedAt)
          .not.toBeNull()

        expect(
          JSON.stringify(
            result.data,
          ),
        ).not.toContain(
          cookieToken,
        )

        expect(writeAuditLog)
          .toHaveBeenCalledWith(
            event,
            null,

            expect.objectContaining({
              associationId,

              action:
                'CRA_CLIENT_ACCESS_OPENED',

              entityType:
                'CraClientAccess',

              entityId:
                accessId,
            }),
          )
      },
    )

    it(
      'échange un token REDOWNLOAD lié au CLIENT_ATTESTED',
      async () => {
        await prisma.craClientAccess
          .deleteMany({
            where: {
              reportId,
            },
          })

        const attestedDocument
          = await prisma.craDocument.create({
            data: {
              reportId,

              type:
                'CLIENT_ATTESTED',

              status:
                'APPROVED',

              version:
                1,

              reportRevision:
                1,

              reference:
                `CRA-EXCHANGE-ATTESTED-${randomUUID()
                  .replaceAll('-', '')
                  .slice(0, 10)
                  .toUpperCase()}`,

              originalName:
                'CRA client attesté.pdf',

              storedName:
                'cra-client-attested.pdf',

              filePath:
                `cra/${reportId}/cra-client-attested.pdf`,

              mimeType:
                'application/pdf',

              fileSize:
                BigInt(456),

              sha256:
                'b'.repeat(64),

              sourceDocumentId:
                documentId,

              antivirusStatus:
                'NOT_APPLICABLE',

              antivirusCheckedAt:
                new Date(),

              antivirusResult:
                'Document généré en interne.',
            },
          })

        await createAccess({
          purpose:
            'REDOWNLOAD',

          documentId:
            attestedDocument.id,
        })

        const emailedTokenHash
          = hashToken(
            emailedToken,
          )

        const result
          = await handler(event)

        expect(result.data)
          .toMatchObject({
            exchanged:
              true,

            purpose:
              'REDOWNLOAD',
          })

        expect(cookie.set)
          .toHaveBeenCalledTimes(1)

        const [
          ,
          cookieName,
          cookieToken,
          options,
        ] = cookie.set.mock.calls[0]!

        expect(cookieName)
          .toBe(
            'ifics_cra_client_access',
          )

        expect(cookieToken)
          .not.toBe(
            emailedToken,
          )

        expect(options)
          .toMatchObject({
            httpOnly:
              true,

            sameSite:
              'strict',

            path:
              '/api/cra-client',
          })

        const stored
          = await prisma.craClientAccess
            .findUniqueOrThrow({
              where: {
                id:
                  accessId,
              },
            })

        expect(stored)
          .toMatchObject({
            documentId:
              attestedDocument.id,

            purpose:
              'REDOWNLOAD',

            status:
              'ACTIVE',
          })

        expect(stored.tokenHash)
          .toBe(
            hashToken(
              cookieToken,
            ),
          )

        expect(stored.tokenHash)
          .not.toBe(
            emailedTokenHash,
          )

        /*
         * Le secret contenu dans l'email a été
         * consommé : il ne peut pas être échangé
         * une deuxième fois.
         */
        cookie.set.mockReset()

        request.body = {
          token:
            emailedToken,
        }

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

        expect(cookie.set)
          .not.toHaveBeenCalled()
      },
    )

    it(
      'rend le token reçu par email inutilisable après le premier échange',
      async () => {
        await handler(event)

        cookie.set.mockReset()

        request.body = {
          token:
            emailedToken,
        }

        await expect(
          handler(event),
        ).rejects.toMatchObject({
          statusCode: 410,

          data: {
            code:
              'CRA_CLIENT_ACCESS_INVALID',
          },
        })

        expect(cookie.set)
          .not.toHaveBeenCalled()
      },
    )

    it(
      'refuse et marque expiré un accès arrivé à expiration',
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
              Date.now() - 1000,
            ),
        })

        await expect(
          handler(event),
        ).rejects.toMatchObject({
          statusCode: 410,

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
          .toBe('EXPIRED')

        expect(cookie.set)
          .not.toHaveBeenCalled()
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
          statusCode: 410,

          data: {
            code:
              'CRA_CLIENT_ACCESS_INVALID',
          },
        })

        expect(cookie.set)
          .not.toHaveBeenCalled()
      },
    )

    it(
      'refuse un accès déjà terminé',
      async () => {
        await prisma.craClientAccess
          .deleteMany({
            where: {
              reportId,
            },
          })

        await createAccess({
          status:
            'COMPLETED',

          completedAt:
            new Date(),
        })

        await expect(
          handler(event),
        ).rejects.toMatchObject({
          statusCode: 410,

          data: {
            code:
              'CRA_CLIENT_ACCESS_INVALID',
          },
        })
      },
    )

    it(
      'refuse un document qui ne correspond plus à la révision du CRA sans consommer le token',
      async () => {
        const initialHash
          = hashToken(
            emailedToken,
          )

        await prisma.craReport.update({
          where: {
            id:
              reportId,
          },

          data: {
            revision:
              2,
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

        expect(access.tokenHash)
          .toBe(initialHash)

        expect(access.firstViewedAt)
          .toBeNull()

        expect(cookie.set)
          .not.toHaveBeenCalled()

        expect(writeAuditLog)
          .not.toHaveBeenCalled()
      },
    )

    it(
      'refuse si le document n’est plus approuvé et CLEAN',
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
          statusCode: 410,

          data: {
            code:
              'CRA_CLIENT_ACCESS_INVALID',
          },
        })

        expect(cookie.set)
          .not.toHaveBeenCalled()
      },
    )
  },
)
