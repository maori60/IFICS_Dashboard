import { randomUUID } from 'node:crypto'
import {
  defineEventHandler,
  type H3Event,
} from 'h3'
import { PDFDocument } from 'pdf-lib'
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

  body: {} as Record<
    string,
    unknown
  >,

  deleteCookie:
    vi.fn(),

  setResponseHeader:
    vi.fn(),
}))

const auditBehavior = vi.hoisted(() => ({
  failStrict: false,
}))

const fileBehavior = vi.hoisted(() => ({
  lastStoredPath:
    null as string | null,

  removedPaths:
    [] as string[],
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

vi.mock(
  '../../server/utils/files',
  async (importOriginal) => {
    const actual = await importOriginal<
      typeof import('../../server/utils/files')
    >()

    return {
      ...actual,

      storePdf:
        async (
          ...args: Parameters<
            typeof actual.storePdf
          >
        ) => {
          const stored
            = await actual.storePdf(
              ...args,
            )

          fileBehavior.lastStoredPath
            = stored.filePath

          return stored
        },

      removeStoredFile:
        async (
          filePath: string,
        ) => {
          fileBehavior.removedPaths
            .push(filePath)

          return actual.removeStoredFile(
            filePath,
          )
        },
    }
  },
)

vi.mock(
  'h3',
  async (importOriginal) => {
    const actual = await importOriginal<
      typeof import('h3')
    >()

    return {
      ...actual,

      getCookie: () =>
        browser.cookie,

      readBody: async () =>
        browser.body,

      deleteCookie:
        browser.deleteCookie,

      setResponseHeader:
        browser.setResponseHeader,

      getRequestHeader: () =>
        undefined,

      getRequestIP: () =>
        undefined,
    }
  },
)

describe.skipIf(
  process.env.CRA_INTEGRATION_TESTS
    !== '1',
)(
  'Décision sécurisée du CRA client avec PostgreSQL',
  () => {
    let prisma:
      typeof import(
        '../../server/utils/prisma'
      )['prisma']

    let hashToken:
      typeof import(
        '../../server/utils/security'
      )['hashToken']

    let storePdf:
      typeof import(
        '../../server/utils/files'
      )['storePdf']

    let removeStoredFile:
      typeof import(
        '../../server/utils/files'
      )['removeStoredFile']

    let readStoredFile:
      typeof import(
        '../../server/utils/files'
      )['readStoredFile']

    let decisionHandler:
      typeof import(
        '../../server/api/cra-client/decision.post'
      )['default']

    let oldConfirmHandler:
      typeof import(
        '../../server/api/cra-client/confirm.post'
      )['default']

    const event = {
      context: {},
    } as H3Event

    const associationId
      = `cra-client-decision-${randomUUID()}`

    const clientEmail
      = `client-${randomUUID()}@example.invalid`

    let intervenorId: string
    let clientId: string
    let projectId: string
    let reportId: string

    let sourceDocumentId: string
    let sourceFilePath: string
    let sourceSha256: string

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
            documentId:
              sourceDocumentId,

            purpose,

            status:
              'ACTIVE',

            tokenHash:
              hashToken(sessionToken),

            recipientEmail:
              clientEmail,

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

      accessId = access.id

      return access
    }

    async function removeDerivedFiles() {
      const documents
        = await prisma.craDocument.findMany({
          where: {
            reportId,

            type:
              'CLIENT_ATTESTED',
          },

          select: {
            filePath:
              true,
          },
        })

      for (
        const document
        of documents
      ) {
        try {
          await removeStoredFile(
            document.filePath,
          )
        }
        catch {
          // Nettoyage physique best effort.
        }
      }
    }

    async function resetDecisionState() {
      await prisma.auditLog.deleteMany({
        where: {
          associationId,

          action:
            'CRA_CLIENT_DECISION_RECORDED',
        },
      })

      await prisma.craClientDecision
        .deleteMany({
          where: {
            reportId,
          },
        })

      await prisma.craClientAccess
        .deleteMany({
          where: {
            reportId,
          },
        })

      await removeDerivedFiles()

      await prisma.craDocument.deleteMany({
        where: {
          reportId,

          type:
            'CLIENT_ATTESTED',
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
            sourceDocumentId,
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

      browser.body
        = {}

      browser.deleteCookie
        .mockReset()

      browser.setResponseHeader
        .mockReset()

      auditBehavior.failStrict
        = false

      fileBehavior.lastStoredPath
        = null

      fileBehavior.removedPaths
        = []

      await createAccess()
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

      const files = await import(
        '../../server/utils/files'
      )

      storePdf
        = files.storePdf

      removeStoredFile
        = files.removeStoredFile

      readStoredFile
        = files.readStoredFile

      decisionHandler = (
        await import(
          '../../server/api/cra-client/decision.post'
        )
      ).default

      oldConfirmHandler = (
        await import(
          '../../server/api/cra-client/confirm.post'
        )
      ).default

      await prisma.association.create({
        data: {
          id:
            associationId,

          name:
            'IFICS test décision CRA client',
        },
      })

      const intervenor
        = await prisma.intervenor.create({
          data: {
            associationId,

            firstName:
              'Jean',

            lastName:
              'Décision',

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
              'Client décision CRA',

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
          },
        })

      clientId = client.id

      const project
        = await prisma.project.create({
          data: {
            associationId,

            reference:
              'MISSION-CLIENT-DECISION',

            title:
              'Mission décision CRA client',

            status:
              'IN_PROGRESS',

            classification:
              'INTERNAL',

            projectClients: {
              create: {
                clientId,

                isMainClient:
                  true,
              },
            },

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

      reportId = report.id

      const sourcePdf
        = await PDFDocument.create()

      sourcePdf.addPage([
        595.28,
        841.89,
      ])

      const sourceBytes
        = Buffer.from(
          await sourcePdf.save(),
        )

      const stored
        = await storePdf(
          'cra',
          reportId,
          'CRA-SIGNED-CLIENT-TEST.pdf',
          sourceBytes,
        )

      sourceFilePath
        = stored.filePath

      sourceSha256
        = stored.sha256

      const sourceDocument
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
              `CRA-CLIENT-DECISION-${randomUUID()
                .replaceAll('-', '')
                .slice(0, 10)
                .toUpperCase()}-SIGNED-V1`,

            ...stored,

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

      sourceDocumentId
        = sourceDocument.id

      fileBehavior.lastStoredPath
        = null

      fileBehavior.removedPaths
        = []
    })

    beforeEach(async () => {
      await resetDecisionState()
    })

    afterAll(async () => {
      try {
        if (!prisma) {
          return
        }

        if (
          !associationId.startsWith(
            'cra-client-decision-',
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
              id:
                true,
            },
          })

        const reportIds
          = reports.map(
            report => report.id,
          )

        if (reportIds.length > 0) {
          await prisma.auditLog.deleteMany({
            where: {
              associationId,
            },
          })

          await prisma.craClientDecision
            .deleteMany({
              where: {
                reportId: {
                  in:
                    reportIds,
                },
              },
            })

          await prisma.craClientAccess
            .deleteMany({
              where: {
                reportId: {
                  in:
                    reportIds,
                },
              },
            })

          const derivedDocuments
            = await prisma.craDocument
              .findMany({
                where: {
                  reportId: {
                    in:
                      reportIds,
                  },

                  type:
                    'CLIENT_ATTESTED',
                },

                select: {
                  filePath:
                    true,
                },
              })

          for (
            const document
            of derivedDocuments
          ) {
            try {
              await removeStoredFile(
                document.filePath,
              )
            }
            catch {
              // Nettoyage physique best effort.
            }
          }

          await prisma.craDocument
            .deleteMany({
              where: {
                reportId: {
                  in:
                    reportIds,
                },

                type:
                  'CLIENT_ATTESTED',
              },
            })

          await prisma.craDocument
            .deleteMany({
              where: {
                reportId: {
                  in:
                    reportIds,
                },
              },
            })
        }

        if (sourceFilePath) {
          try {
            await removeStoredFile(
              sourceFilePath,
            )
          }
          catch {
            // Nettoyage physique best effort.
          }
        }

        await prisma.craReport.deleteMany({
          where: {
            associationId,
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

        await prisma.projectIntervenor
          .deleteMany({
            where: {
              project: {
                associationId,
              },
            },
          })

        await prisma.project.deleteMany({
          where: {
            associationId,
          },
        })

        await prisma.client.deleteMany({
          where: {
            associationId,
          },
        })

        await prisma.intervenor.deleteMany({
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
      }
      finally {
        vi.unstubAllGlobals()

        if (prisma) {
          await prisma.$disconnect()
        }
      }
    })

    it(
      'accepte le CRA, crée le PDF attesté et clôture l’accès',
      async () => {
        browser.body = {
          decision:
            'ACCEPTED',

          firstName:
            'Alice',

          lastName:
            'Martin',

          jobTitle:
            'Responsable cliente',

          comment:
            'CRA vérifié et accepté.',
        }

        const result
          = await decisionHandler(
            event,
          )

        expect(
          result.data.decision.decision,
        ).toBe('ACCEPTED')

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

        const decision
          = await prisma.craClientDecision
            .findUniqueOrThrow({
              where: {
                accessId_reportId: {
                  accessId,
                  reportId,
                },
              },
            })

        expect(decision.decision)
          .toBe('ACCEPTED')

        expect(decision.firstName)
          .toBe('Alice')

        expect(decision.lastName)
          .toBe('Martin')

        expect(decision.jobTitle)
          .toBe('Responsable cliente')

        expect(decision.organizationName)
          .toBe(
            'Client décision CRA',
          )

        expect(decision.recipientEmail)
          .toBe(clientEmail)

        expect(
          decision.sourceDocumentId,
        ).toBe(sourceDocumentId)

        expect(
          decision.sourceDocumentSha256,
        ).toBe(sourceSha256)

        const attestedDocument
          = await prisma.craDocument
            .findUniqueOrThrow({
              where: {
                id:
                  decision.attestedDocumentId,
              },
            })

        expect(attestedDocument.type)
          .toBe('CLIENT_ATTESTED')

        expect(attestedDocument.status)
          .toBe('APPROVED')

        expect(
          attestedDocument.sourceDocumentId,
        ).toBe(sourceDocumentId)

        expect(
          attestedDocument.reportRevision,
        ).toBe(3)

        expect(
          attestedDocument.sha256,
        ).toMatch(/^[a-f0-9]{64}$/)

        const attestedBytes
          = await readStoredFile(
            attestedDocument.filePath,
          )

        expect(
          BigInt(attestedBytes.length),
        ).toBe(
          attestedDocument.fileSize,
        )

        const pdf
          = await PDFDocument.load(
            attestedBytes,
          )

        expect(
          pdf.getPageCount(),
        ).toBe(2)

        const audits
          = await prisma.auditLog.findMany({
            where: {
              associationId,

              action:
                'CRA_CLIENT_DECISION_RECORDED',

              entityType:
                'CraClientDecision',

              entityId:
                decision.id,
            },
          })

        expect(audits)
          .toHaveLength(1)

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
      'enregistre un refus sans remplir confirmedAt',
      async () => {
        browser.body = {
          decision:
            'REFUSED',

          firstName:
            'Alice',

          lastName:
            'Martin',

          jobTitle:
            'Responsable cliente',

          comment:
            'Une correction est nécessaire.',
        }

        await decisionHandler(event)

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
          .toBeNull()

        expect(access.completedAt)
          .not.toBeNull()

        const decision
          = await prisma.craClientDecision
            .findUniqueOrThrow({
              where: {
                accessId_reportId: {
                  accessId,
                  reportId,
                },
              },
            })

        expect(decision.decision)
          .toBe('REFUSED')

        expect(decision.comment)
          .toBe(
            'Une correction est nécessaire.',
          )

        const attestedDocument
          = await prisma.craDocument
            .findUniqueOrThrow({
              where: {
                id:
                  decision.attestedDocumentId,
              },
            })

        expect(attestedDocument.type)
          .toBe('CLIENT_ATTESTED')
      },
    )

    it(
      'refuse un refus sans commentaire sans modifier les données',
      async () => {
        browser.body = {
          decision:
            'REFUSED',

          firstName:
            'Alice',

          lastName:
            'Martin',

          jobTitle:
            'Responsable cliente',

          comment:
            '',
        }

        await expect(
          decisionHandler(event),
        ).rejects.toMatchObject({
          statusCode:
            400,

          data: {
            code:
              'CRA_CLIENT_REFUSAL_COMMENT_REQUIRED',
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
          await prisma.craClientDecision.count({
            where: {
              reportId,
            },
          }),
        ).toBe(0)

        expect(
          await prisma.craDocument.count({
            where: {
              reportId,

              type:
                'CLIENT_ATTESTED',
            },
          }),
        ).toBe(0)

        expect(
          browser.deleteCookie,
        ).not.toHaveBeenCalled()
      },
    )

    it(
      'annule la transaction et supprime le PDF généré si l’audit strict échoue',
      async () => {
        auditBehavior.failStrict
          = true

        browser.body = {
          decision:
            'ACCEPTED',

          firstName:
            'Alice',

          lastName:
            'Martin',

          jobTitle:
            'Responsable cliente',

          comment:
            null,
        }

        await expect(
          decisionHandler(event),
        ).rejects.toThrow(
          'AUDIT_STRICT_TEST_FAILURE',
        )

        const generatedPath
          = fileBehavior.lastStoredPath

        expect(generatedPath)
          .toBeTruthy()

        expect(
          fileBehavior.removedPaths,
        ).toContain(
          generatedPath,
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
          await prisma.craClientDecision.count({
            where: {
              reportId,
            },
          }),
        ).toBe(0)

        expect(
          await prisma.craDocument.count({
            where: {
              reportId,

              type:
                'CLIENT_ATTESTED',
            },
          }),
        ).toBe(0)

        expect(
          browser.deleteCookie,
        ).not.toHaveBeenCalled()
      },
    )

    it(
      'n’autorise qu’une seule décision concurrente',
      async () => {
        browser.body = {
          decision:
            'ACCEPTED',

          firstName:
            'Alice',

          lastName:
            'Martin',

          jobTitle:
            'Responsable cliente',

          comment:
            'Validation concurrente.',
        }

        const results
          = await Promise.allSettled([
            decisionHandler(event),
            decisionHandler(event),
          ])

        const successes
          = results.filter(
            result =>
              result.status
              === 'fulfilled',
          )

        const failures
          = results.filter(
            result =>
              result.status
              === 'rejected',
          )

        expect(successes)
          .toHaveLength(1)

        expect(failures)
          .toHaveLength(1)

        expect(
          await prisma.craClientDecision.count({
            where: {
              reportId,
            },
          }),
        ).toBe(1)

        expect(
          await prisma.craDocument.count({
            where: {
              reportId,

              type:
                'CLIENT_ATTESTED',
            },
          }),
        ).toBe(1)

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
      'interdit la décision depuis un accès REDOWNLOAD',
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

        browser.body = {
          decision:
            'ACCEPTED',

          firstName:
            'Alice',

          lastName:
            'Martin',

          jobTitle:
            'Responsable cliente',

          comment:
            null,
        }

        await expect(
          decisionHandler(event),
        ).rejects.toMatchObject({
          statusCode:
            403,

          data: {
            code:
              'CRA_CLIENT_DECISION_FORBIDDEN',
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

        expect(
          await prisma.craClientDecision.count({
            where: {
              reportId,
            },
          }),
        ).toBe(0)
      },
    )

    it(
      'neutralise définitivement l’ancienne route de confirmation simple',
      async () => {
        await expect(
          oldConfirmHandler(event),
        ).rejects.toMatchObject({
          statusCode:
            410,

          data: {
            code:
              'CRA_CLIENT_CONFIRMATION_REPLACED',
          },
        })
      },
    )
  },
)
