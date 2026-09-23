import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import {
  defineEventHandler,
  type H3Event,
} from 'h3'
import {
  PDFDocument,
  StandardFonts,
} from 'pdf-lib'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  removeStoredFile,
  resolveStoredPath,
  storePdf,
} from '../../server/utils/files'

const browser = vi.hoisted(() => ({
  cookie: undefined as string | undefined,

  query: {} as Record<
    string,
    string | undefined
  >,

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

    getQuery: () =>
      browser.query,

    deleteCookie:
      browser.deleteCookie,

    setResponseHeader:
      browser.setResponseHeader,
  }
})

describe.skipIf(
  process.env.CRA_INTEGRATION_TESTS !== '1',
)(
  'Lecture sécurisée du document CRA client avec PostgreSQL',
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
        '../../server/api/cra-client/document.get'
      )['default']

    const event = {} as H3Event

    const associationId
      = `cra-client-document-${randomUUID()}`

    let intervenorId: string
    let projectId: string
    let reportId: string
    let documentId: string
    let accessId: string

    let sessionToken: string

    let pdfBuffer: Buffer
    let storedFilePath: string
    let storedSha256: string
    let storedFileSize: bigint

    async function createAccess(
      options: {
        purpose?:
          | 'INITIAL_CONFIRMATION'
          | 'REDOWNLOAD'

        documentId?: string
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

            documentId:
              options.documentId
              ?? documentId,

            purpose:
              options.purpose
              ?? 'INITIAL_CONFIRMATION',

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

      accessId = access.id
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
          '../../server/api/cra-client/document.get'
        )
      ).default

      await prisma.association.create({
        data: {
          id:
            associationId,

          name:
            'IFICS test document CRA client',
        },
      })

      const intervenor
        = await prisma.intervenor.create({
          data: {
            associationId,

            firstName:
              'Jean',

            lastName:
              'Document',

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
              'MISSION-CLIENT-DOCUMENT',

            title:
              'Mission document CRA client',

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

      const pdf
        = await PDFDocument.create()

      const page
        = pdf.addPage([
          595,
          842,
        ])

      const font
        = await pdf.embedFont(
          StandardFonts.Helvetica,
        )

      page.drawText(
        'CRA client integration test',
        {
          x: 60,
          y: 760,
          size: 14,
          font,
        },
      )

      pdfBuffer
        = Buffer.from(
          await pdf.save(),
        )

      const stored
        = await storePdf(
          'cra',
          reportId,
          'CRA signé client.pdf',
          pdfBuffer,
        )

      storedFilePath
        = stored.filePath

      storedSha256
        = stored.sha256

      storedFileSize
        = stored.fileSize

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
              `CRA-CLIENT-DOCUMENT-${randomUUID()
                .replaceAll('-', '')
                .slice(0, 10)
                .toUpperCase()}`,

            originalName:
              'CRA signé client.pdf',

            storedName:
              stored.storedName,

            filePath:
              stored.filePath,

            mimeType:
              stored.mimeType,

            fileSize:
              stored.fileSize,

            sha256:
              stored.sha256,

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

          mimeType:
            'application/pdf',

          fileSize:
            storedFileSize,

          sha256:
            storedSha256,

          antivirusStatus:
            'CLEAN',

          archivedAt:
            null,
        },
      })

      await writeFile(
        resolveStoredPath(
          storedFilePath,
        ),
        pdfBuffer,
      )

      browser.cookie
        = undefined

      browser.query
        = {}

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
              'cra-client-document-',
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

                documents: {
                  select: {
                    filePath: true,
                  },
                },
              },
            })

          const testReportIds
            = testReports.map(
              report => report.id,
            )

          const testFilePaths
            = testReports.flatMap(
              report =>
                report.documents.map(
                  document =>
                    document.filePath,
                ),
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

          for (
            const filePath
            of testFilePaths
          ) {
            if (
              filePath.startsWith(
                'cra/',
              )
            ) {
              await removeStoredFile(
                filePath,
              )
            }
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
      'affiche le document inline sans enregistrer de téléchargement',
      async () => {
        const result
          = await handler(event)

        expect(Buffer.isBuffer(result))
          .toBe(true)

        expect(result.equals(pdfBuffer))
          .toBe(true)

        expect(
          browser.setResponseHeader,
        ).toHaveBeenCalledWith(
          event,
          'Content-Type',
          'application/pdf',
        )

        expect(
          browser.setResponseHeader,
        ).toHaveBeenCalledWith(
          event,
          'Content-Disposition',
          expect.stringContaining(
            'inline;',
          ),
        )

        expect(
          browser.setResponseHeader,
        ).toHaveBeenCalledWith(
          event,
          'X-Content-Type-Options',
          'nosniff',
        )

        expect(
          browser.setResponseHeader,
        ).toHaveBeenCalledWith(
          event,
          'X-Frame-Options',
          'SAMEORIGIN',
        )

        expect(
          browser.setResponseHeader,
        ).toHaveBeenCalledWith(
          event,
          'Content-Security-Policy',
          "frame-ancestors 'self'",
        )

        const access
          = await prisma.craClientAccess
            .findUniqueOrThrow({
              where: {
                id:
                  accessId,
              },
            })

        expect(access.downloadedAt)
          .toBeNull()
      },
    )

    it(
      'télécharge le document et enregistre downloadedAt',
      async () => {
        browser.query = {
          download:
            '1',
        }

        const result
          = await handler(event)

        expect(result.equals(pdfBuffer))
          .toBe(true)

        expect(
          browser.setResponseHeader,
        ).toHaveBeenCalledWith(
          event,
          'Content-Disposition',
          expect.stringContaining(
            'attachment;',
          ),
        )

        const access
          = await prisma.craClientAccess
            .findUniqueOrThrow({
              where: {
                id:
                  accessId,
              },
            })

        expect(access.downloadedAt)
          .not.toBeNull()
      },
    )

    it(
      'sert le CLIENT_ATTESTED depuis un accès REDOWNLOAD',
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
                3,

              reference:
                `CRA-CLIENT-REDOWNLOAD-${randomUUID()
                  .replaceAll('-', '')
                  .slice(0, 10)
                  .toUpperCase()}`,

              originalName:
                'CRA client attesté.pdf',

              storedName:
                'cra-client-attested.pdf',

              filePath:
                storedFilePath,

              mimeType:
                'application/pdf',

              fileSize:
                storedFileSize,

              sha256:
                storedSha256,

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

        try {
          await createAccess({
            purpose:
              'REDOWNLOAD',

            documentId:
              attestedDocument.id,
          })

          browser.query = {}

          const inlineResult
            = await handler(event)

          expect(
            inlineResult.equals(
              pdfBuffer,
            ),
          ).toBe(true)

          expect(
            browser.setResponseHeader,
          ).toHaveBeenCalledWith(
            event,
            'Content-Disposition',
            expect.stringContaining(
              'inline;',
            ),
          )

          let access
            = await prisma.craClientAccess
              .findUniqueOrThrow({
                where: {
                  id:
                    accessId,
                },
              })

          expect(access)
            .toMatchObject({
              documentId:
                attestedDocument.id,

              purpose:
                'REDOWNLOAD',

              status:
                'ACTIVE',

              downloadedAt:
                null,
            })

          browser.setResponseHeader
            .mockReset()

          browser.query = {
            download:
              '1',
          }

          const downloadedResult
            = await handler(event)

          expect(
            downloadedResult.equals(
              pdfBuffer,
            ),
          ).toBe(true)

          expect(
            browser.setResponseHeader,
          ).toHaveBeenCalledWith(
            event,
            'Content-Disposition',
            expect.stringContaining(
              'attachment;',
            ),
          )

          expect(
            browser.setResponseHeader,
          ).toHaveBeenCalledWith(
            event,
            'Content-Type',
            'application/pdf',
          )

          access
            = await prisma.craClientAccess
              .findUniqueOrThrow({
                where: {
                  id:
                    accessId,
                },
              })

          expect(access.documentId)
            .toBe(
              attestedDocument.id,
            )

          expect(access.purpose)
            .toBe(
              'REDOWNLOAD',
            )

          expect(access.downloadedAt)
            .not.toBeNull()
        }
        finally {
          await prisma.craClientAccess
            .deleteMany({
              where: {
                documentId:
                  attestedDocument.id,
              },
            })

          await prisma.craDocument
            .delete({
              where: {
                id:
                  attestedDocument.id,
              },
            })
        }
      },
    )

    it(
      'conserve la première date de téléchargement',
      async () => {
        const firstDate
          = new Date(
            '2026-09-21T12:00:00.000Z',
          )

        await prisma.craClientAccess.update({
          where: {
            id:
              accessId,
          },

          data: {
            downloadedAt:
              firstDate,
          },
        })

        browser.query = {
          download:
            '1',
        }

        await handler(event)

        const access
          = await prisma.craClientAccess
            .findUniqueOrThrow({
              where: {
                id:
                  accessId,
              },
            })

        expect(
          access.downloadedAt
            ?.toISOString(),
        ).toBe(
          firstDate.toISOString(),
        )
      },
    )

    it(
      'refuse sans cookie client',
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
      'refuse un MIME non autorisé',
      async () => {
        await prisma.craDocument.update({
          where: {
            id:
              documentId,
          },

          data: {
            mimeType:
              'application/octet-stream',
          },
        })

        await expect(
          handler(event),
        ).rejects.toMatchObject({
          statusCode:
            409,

          data: {
            code:
              'CRA_CLIENT_DOCUMENT_INVALID_TYPE',
          },
        })
      },
    )

    it(
      'refuse un document sans SHA-256',
      async () => {
        await prisma.craDocument.update({
          where: {
            id:
              documentId,
          },

          data: {
            sha256:
              null,
          },
        })

        await expect(
          handler(event),
        ).rejects.toMatchObject({
          statusCode:
            409,

          data: {
            code:
              'CRA_CLIENT_DOCUMENT_HASH_MISSING',
          },
        })
      },
    )

    it(
      'refuse si la taille physique ne correspond plus',
      async () => {
        await prisma.craDocument.update({
          where: {
            id:
              documentId,
          },

          data: {
            fileSize:
              storedFileSize
              + BigInt(1),
          },
        })

        await expect(
          handler(event),
        ).rejects.toMatchObject({
          statusCode:
            409,

          data: {
            code:
              'CRA_CLIENT_DOCUMENT_SIZE_MISMATCH',
          },
        })
      },
    )

    it(
      'refuse si le SHA-256 physique ne correspond plus',
      async () => {
        const altered
          = Buffer.concat([
            pdfBuffer,
            Buffer.from('x'),
          ])

        await writeFile(
          resolveStoredPath(
            storedFilePath,
          ),
          altered,
        )

        await prisma.craDocument.update({
          where: {
            id:
              documentId,
          },

          data: {
            fileSize:
              BigInt(
                altered.length,
              ),
          },
        })

        await expect(
          handler(event),
        ).rejects.toMatchObject({
          statusCode:
            409,

          data: {
            code:
              'CRA_CLIENT_DOCUMENT_HASH_MISMATCH',
          },
        })
      },
    )
  },
)
