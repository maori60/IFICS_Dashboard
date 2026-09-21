import { randomUUID } from 'node:crypto'
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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

const request = vi.hoisted(() => ({
  reportId: '',
  associationId: '',
  userId: 'cra-signed-uploader',
  intervenorId: '',
  roleCode: 'INTERVENOR',
  permissions: [
    'cra:read:own',
    'cra:write:own',
  ] as string[],
  documentId: '',
  query: {} as Record<string, string>,
  parts: [] as Array<{
    name: string
    filename?: string
    type?: string
    data: Buffer
  }>,
}))

const writeAuditLog = vi.hoisted(() => vi.fn())

const responseHeaders = vi.hoisted(
  () => ({} as Record<string, string>),
)

const scanBufferWithClamAv = vi.hoisted(
  () => vi.fn(),
)

vi.mock('h3', async (importOriginal) => {
  const actual
    = await importOriginal<typeof import('h3')>()

  return {
    ...actual,

    getRouterParam: (
      _event: unknown,
      name: string,
    ) =>
      name === 'documentId'
        ? request.documentId
        : request.reportId,

    getQuery: () =>
      request.query,

    setResponseHeader: (
      _event: unknown,
      name: string,
      value: string | number,
    ) => {
      responseHeaders[name.toLowerCase()]
        = String(value)
    },

    readMultipartFormData: async () =>
      request.parts,
  }
})

vi.mock('../../server/utils/auth', () => ({
  requireAuth: async () => ({
    sessionId: 'cra-signed-session',
    userId: request.userId,
    associationId: request.associationId,
    clientId: null,
    intervenorId: request.intervenorId,
    email: 'intervenant@example.invalid',
    firstName: 'Test',
    lastName: 'Intervenant',
    roleCode: request.roleCode,
    roleName: 'Intervenant',
    permissions: request.permissions,
    mfaEnabled: false,
    mfaVerified: false,
    mfaSetupRequired: false,
  }),

  hasPermission: (
    context: { permissions: string[] },
    permission: string,
  ) =>
    context.permissions.includes('*')
    || context.permissions.includes(permission),
}))

vi.mock('../../server/utils/audit', () => ({
  writeAuditLog,
}))

vi.mock(
  '../../server/utils/antivirus',
  async (importOriginal) => {
    const actual
      = await importOriginal<
        typeof import('../../server/utils/antivirus')
      >()

    return {
      ...actual,
      scanBufferWithClamAv,
    }
  },
)

describe.skipIf(
  process.env.CRA_INTEGRATION_TESTS !== '1',
)(
  'Dépôt sécurisé du CRA signé avec PostgreSQL',
  () => {
    let prisma:
      typeof import('../../server/utils/prisma')['prisma']

    let handler:
      typeof import('../../server/api/cra/[id]/upload-signed.post')['default']

    let readHandler:
      typeof import('../../server/api/cra/[id]/index.get')['default']

    let documentReadHandler:
      typeof import('../../server/api/cra/[id]/documents/[documentId].get')['default']

    let resolveStoredPath:
      typeof import('../../server/utils/files')['resolveStoredPath']

    let reportId: string
    let projectId: string
    let intervenorId: string
    let otherIntervenorId: string
    let sourceV2Id: string

    let uploadRoot = ''

    const event = {} as H3Event

    const associationId
      = `cra-signed-${randomUUID()}`

    const referenceToken
      = randomUUID()
        .replaceAll('-', '')
        .slice(0, 8)
        .toUpperCase()

    async function validSignedPdf():
      Promise<Buffer> {
      const pdf = await PDFDocument.create()

      pdf.addPage([595, 842])
      pdf.addPage([595, 842])

      return Buffer.from(
        await pdf.save(),
      )
    }

    async function countFiles(
      directory: string,
    ): Promise<number> {
      let entries

      try {
        entries = await readdir(
          directory,
          {
            withFileTypes: true,
          },
        )
      }
      catch (error) {
        if (
          typeof error === 'object'
          && error !== null
          && 'code' in error
          && error.code === 'ENOENT'
        ) {
          return 0
        }

        throw error
      }

      let count = 0

      for (const entry of entries) {
        const path = join(
          directory,
          entry.name,
        )

        if (entry.isDirectory()) {
          count += await countFiles(path)
        }
        else {
          count++
        }
      }

      return count
    }

    async function cleanUploadFiles() {
      await rm(
        join(uploadRoot, 'cra'),
        {
          recursive: true,
          force: true,
        },
      )

      await rm(
        join(uploadRoot, 'quarantine'),
        {
          recursive: true,
          force: true,
        },
      )
    }

    async function createOfficialDocuments() {
      await prisma.craDocument.deleteMany({
        where: {
          reportId,
        },
      })

      await prisma.craDocument.create({
        data: {
          reportId,
          type: 'IFICS_TO_SIGN',
          status: 'SUPERSEDED',
          version: 1,
          reportRevision: 3,

          reference:
            `CRA-2026-09-${referenceToken}-V1`,

          originalName:
            `CRA-2026-09-${referenceToken}-V1.pdf`,

          storedName:
            'official-v1.pdf',

          filePath:
            `cra/${reportId}/official-v1.pdf`,

          mimeType:
            'application/pdf',

          fileSize:
            BigInt(100),

          sha256:
            '1'.repeat(64),

          generatedByUserId:
            'cra-admin',

          antivirusStatus:
            'NOT_APPLICABLE',

          antivirusCheckedAt:
            new Date(),

          antivirusResult:
            'Generated by IFICS',

          archivedAt:
            new Date(),
        },
      })

      const sourceV2
        = await prisma.craDocument.create({
          data: {
            reportId,
            type: 'IFICS_TO_SIGN',
            status: 'SENT_TO_INTERVENOR',
            version: 2,
            reportRevision: 3,

            reference:
              `CRA-2026-09-${referenceToken}-V2`,

            originalName:
              `CRA-2026-09-${referenceToken}-V2.pdf`,

            storedName:
              'official-v2.pdf',

            filePath:
              `cra/${reportId}/official-v2.pdf`,

            mimeType:
              'application/pdf',

            fileSize:
              BigInt(200),

            sha256:
              '2'.repeat(64),

            generatedByUserId:
              'cra-admin',

            sentToIntervenorAt:
              new Date(),

            antivirusStatus:
              'NOT_APPLICABLE',

            antivirusCheckedAt:
              new Date(),

            antivirusResult:
              'Generated by IFICS',
          },
        })

      sourceV2Id = sourceV2.id
    }

    beforeAll(async () => {
      vi.stubGlobal(
        'defineEventHandler',
        defineEventHandler,
      )

      uploadRoot = await mkdtemp(
        join(
          tmpdir(),
          'ifics-cra-signed-route-',
        ),
      )

      process.env.UPLOAD_DIR = uploadRoot

      prisma = (
        await import(
          '../../server/utils/prisma'
        )
      ).prisma

      resolveStoredPath = (
        await import(
          '../../server/utils/files'
        )
      ).resolveStoredPath

      handler = (
        await import(
          '../../server/api/cra/[id]/upload-signed.post'
        )
      ).default

      readHandler = (
        await import(
          '../../server/api/cra/[id]/index.get'
        )
      ).default

      documentReadHandler = (
        await import(
          '../../server/api/cra/[id]/documents/[documentId].get'
        )
      ).default

      await prisma.association.create({
        data: {
          id: associationId,
          name: 'IFICS',
          legalName: 'IFICS France',
          billingName: 'IFICS France',
        },
      })

      const intervenor
        = await prisma.intervenor.create({
          data: {
            associationId,
            firstName: 'Alice',
            lastName: 'Intervenante',
            email:
              `${referenceToken.toLowerCase()}-alice@example.invalid`,
            status: 'ACTIVE',
          },
        })

      intervenorId = intervenor.id

      const otherIntervenor
        = await prisma.intervenor.create({
          data: {
            associationId,
            firstName: 'Bob',
            lastName: 'Intervenant',
            email:
              `${referenceToken.toLowerCase()}-bob@example.invalid`,
            status: 'ACTIVE',
          },
        })

      otherIntervenorId
        = otherIntervenor.id

      const project
        = await prisma.project.create({
          data: {
            associationId,
            reference:
              `SIGNED-${referenceToken}`,
            title:
              'Mission dépôt CRA signé',
            status: 'IN_PROGRESS',
            classification: 'INTERNAL',

            projectIntervenors: {
              create: [
                {
                  intervenorId,
                  assignmentStatus:
                    'ACCEPTED',
                },
                {
                  intervenorId:
                    otherIntervenorId,

                  assignmentStatus:
                    'ACCEPTED',
                },
              ],
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
            status: 'REVIEWED',
            revision: 3,
            reviewedAt: new Date(),
            reviewedById:
              'cra-admin',
          },
        })

      reportId = report.id
    })

    beforeEach(async () => {
      await cleanUploadFiles()

      await prisma.craDocument.deleteMany({
        where: {
          reportId,
        },
      })

      await prisma.craReport.update({
        where: {
          id: reportId,
        },

        data: {
          status: 'REVIEWED',
          revision: 3,
          reviewedAt: new Date(),
          reviewedById:
            'cra-admin',
        },
      })

      await createOfficialDocuments()

      request.reportId = reportId
      request.associationId
        = associationId

      request.intervenorId
        = intervenorId

      request.roleCode
        = 'INTERVENOR'

      request.permissions = [
        'cra:read:own',
        'cra:write:own',
      ]

      request.parts = [
        {
          name: 'file',
          filename:
            'CRA-signe.pdf',
          type:
            'application/pdf',
          data:
            await validSignedPdf(),
        },
      ]

      scanBufferWithClamAv
        .mockReset()

      scanBufferWithClamAv
        .mockResolvedValue({
          status: 'CLEAN',
          rawResult: 'stream: OK',
        })

      writeAuditLog.mockReset()

      request.documentId = ''
      request.query = {}

      for (const key of Object.keys(responseHeaders)) {
        Reflect.deleteProperty(responseHeaders, key)
      }
    })

    afterAll(async () => {
      try {
        if (prisma) {
          if (
            !associationId.startsWith('cra-signed-')
          ) {
            throw new Error(
              'Refus du nettoyage : association de test invalide.',
            )
          }

          /*
           * Sécurité critique :
           * si beforeAll échoue avant l'initialisation
           * complète du fixture, ne jamais transmettre
           * un identifiant undefined à Prisma.
           */
          if (
            !reportId
            || !projectId
            || !intervenorId
            || !otherIntervenorId
          ) {
            return
          }

          await prisma.craDocument.deleteMany({
            where: {
              reportId,
            },
          })

          await prisma.craReport.deleteMany({
            where: {
              id: reportId,
            },
          })

          await prisma.projectIntervenor.deleteMany({
            where: {
              projectId,
            },
          })

          await prisma.project.deleteMany({
            where: {
              id: projectId,
            },
          })

          await prisma.intervenor.deleteMany({
            where: {
              id: {
                in: [
                  intervenorId,
                  otherIntervenorId,
                ],
              },
            },
          })

          await prisma.association.deleteMany({
            where: {
              id: associationId,
            },
          })
        }
      }
      finally {
        delete process.env.UPLOAD_DIR

        if (uploadRoot) {
          await rm(
            uploadRoot,
            {
              recursive: true,
              force: true,
            },
          )
        }

        vi.unstubAllGlobals()
      }
    })

    it(
      'accepte un PDF sain et le lie exactement à la V2 envoyée',
      async () => {
        const originalBuffer
          = request.parts[0]!.data

        const result
          = await handler(event)

        expect(result.data)
          .toMatchObject({
            type: 'INTERVENOR_SIGNED',
            status: 'RECEIVED',
            version: 1,
            sourceDocumentId:
              sourceV2Id,
            antivirusStatus:
              'CLEAN',
          })

        const document
          = await prisma.craDocument.findUnique({
            where: {
              id: result.data.id,
            },
          })

        expect(document)
          .toMatchObject({
            reportId,
            type:
              'INTERVENOR_SIGNED',
            status:
              'RECEIVED',
            version: 1,
            reportRevision: 3,
            sourceDocumentId:
              sourceV2Id,
            uploadedByUserId:
              request.userId,
            antivirusStatus:
              'CLEAN',
          })

        expect(
          document?.reference,
        ).toBe(
          `CRA-2026-09-${referenceToken}-V2-SIGNED-V1`,
        )

        expect(
          document?.receivedAt,
        ).not.toBeNull()

        expect(
          document?.antivirusCheckedAt,
        ).not.toBeNull()

        const storedBuffer
          = await readFile(
            resolveStoredPath(
              document!.filePath,
            ),
          )

        expect(
          storedBuffer.equals(
            originalBuffer,
          ),
        ).toBe(true)

        expect(
          await countFiles(
            join(
              uploadRoot,
              'quarantine',
            ),
          ),
        ).toBe(0)

        expect(writeAuditLog)
          .toHaveBeenCalledWith(
            event,
            expect.anything(),
            expect.objectContaining({
              action:
                'CRA_SIGNED_DOCUMENT_RECEIVED',

              entityType:
                'CraDocument',

              entityId:
                result.data.id,

              metadata:
                expect.objectContaining({
                  sourceDocumentId:
                    sourceV2Id,

                  sourceVersion: 2,

                  antivirusStatus:
                    'CLEAN',
                }),
            }),
          )
      },
    )

    it(
      'expose au seul intervenant des métadonnées sûres du CRA signé',
      async () => {
        const before = await readHandler(event)

        expect(
          before.data.canUploadSignedDocument,
        ).toBe(true)

        expect(
          before.data.signedDocument,
        ).toBeNull()

        const uploaded = await handler(event)

        const after = await readHandler(event)

        expect(
          after.data.officialDocument,
        ).toBeNull()

        expect(
          after.data.canUploadSignedDocument,
        ).toBe(false)

        expect(
          after.data.signedDocument,
        ).toMatchObject({
          id: uploaded.data.id,
          type: 'INTERVENOR_SIGNED',
          status: 'RECEIVED',
          version: 1,
          antivirusStatus: 'CLEAN',

          sourceDocument: {
            id: sourceV2Id,
            version: 2,
            reference:
              `CRA-2026-09-${referenceToken}-V2`,
          },
        })

        expect(
          after.data.signedDocument,
        ).not.toHaveProperty('filePath')

        expect(
          after.data.signedDocument,
        ).not.toHaveProperty('storedName')

        expect(
          after.data.signedDocument,
        ).not.toHaveProperty('sha256')
      },
    )

    it(
      'permet à IFICS de visualiser le CRA signé CLEAN sans altérer ses octets',
      async () => {
        const original
          = request.parts[0]!.data

        const uploaded
          = await handler(event)

        request.documentId
          = uploaded.data.id

        request.roleCode
          = 'ADMIN'

        request.intervenorId
          = ''

        request.permissions = [
          'cra:read:all',
        ]

        const returned
          = await documentReadHandler(event)

        expect(
          Buffer.isBuffer(returned),
        ).toBe(true)

        expect(
          returned.equals(original),
        ).toBe(true)

        expect(
          responseHeaders['content-type'],
        ).toBe('application/pdf')

        expect(
          responseHeaders['cache-control'],
        ).toBe(
          'private, no-store, max-age=0',
        )

        expect(
          responseHeaders['x-content-type-options'],
        ).toBe('nosniff')
      },
    )

    it(
      'interdit à l’intervenant la lecture directe du fichier signé',
      async () => {
        const uploaded
          = await handler(event)

        request.documentId
          = uploaded.data.id

        await expect(
          documentReadHandler(event),
        ).rejects.toMatchObject({
          statusCode: 403,

          data:
            expect.objectContaining({
              code:
                'CRA_DOCUMENT_FORBIDDEN',
            }),
        })
      },
    )

    it(
      'refuse un fichier déclaré infecté et ne conserve rien',
      async () => {
        scanBufferWithClamAv
          .mockResolvedValueOnce({
            status: 'INFECTED',
            signature:
              'Eicar-Test-Signature',
            rawResult:
              'stream: Eicar-Test-Signature FOUND',
          })

        await expect(
          handler(event),
        ).rejects.toMatchObject({
          statusCode: 422,

          data:
            expect.objectContaining({
              code:
                'CRA_SIGNED_FILE_INFECTED',
            }),
        })

        expect(
          await prisma.craDocument.count({
            where: {
              reportId,
              type:
                'INTERVENOR_SIGNED',
            },
          }),
        ).toBe(0)

        expect(
          await countFiles(
            join(
              uploadRoot,
              'cra',
              reportId,
            ),
          ),
        ).toBe(0)

        expect(
          await countFiles(
            join(
              uploadRoot,
              'quarantine',
            ),
          ),
        ).toBe(0)

        expect(writeAuditLog)
          .toHaveBeenCalledWith(
            event,
            expect.anything(),
            expect.objectContaining({
              action:
                'CRA_SIGNED_DOCUMENT_INFECTED',

              outcome:
                'FAILURE',
            }),
          )
      },
    )

    it(
      'refuse le dépôt si ClamAV est indisponible et supprime la quarantaine',
      async () => {
        const {
          ClamAvError,
        } = await import(
          '../../server/utils/antivirus'
        )

        scanBufferWithClamAv
          .mockRejectedValueOnce(
            new ClamAvError(
              'CLAMAV_UNAVAILABLE',
              'ClamAV indisponible pour le test.',
            ),
          )

        await expect(
          handler(event),
        ).rejects.toMatchObject({
          statusCode: 503,

          data:
            expect.objectContaining({
              code:
                'CLAMAV_UNAVAILABLE',
            }),
        })

        expect(
          await prisma.craDocument.count({
            where: {
              reportId,
              type:
                'INTERVENOR_SIGNED',
            },
          }),
        ).toBe(0)

        expect(
          await countFiles(
            join(
              uploadRoot,
              'quarantine',
            ),
          ),
        ).toBe(0)

        expect(writeAuditLog)
          .toHaveBeenCalledWith(
            event,
            expect.anything(),
            expect.objectContaining({
              action:
                'CRA_SIGNED_DOCUMENT_SCAN_FAILED',

              outcome:
                'FAILURE',
            }),
          )
      },
    )

    it(
      'interdit à un autre intervenant de déposer sur ce CRA',
      async () => {
        request.intervenorId
          = otherIntervenorId

        await expect(
          handler(event),
        ).rejects.toMatchObject({
          statusCode: 404,

          data:
            expect.objectContaining({
              code:
                'CRA_NOT_FOUND',
            }),
        })

        expect(
          scanBufferWithClamAv,
        ).not.toHaveBeenCalled()

        expect(
          await prisma.craDocument.count({
            where: {
              reportId,
              type:
                'INTERVENOR_SIGNED',
            },
          }),
        ).toBe(0)
      },
    )

    it(
      'refuse un CRA officiel qui n’a pas été envoyé à l’intervenant',
      async () => {
        await prisma.craDocument.update({
          where: {
            id: sourceV2Id,
          },

          data: {
            status: 'GENERATED',
            sentToIntervenorAt: null,
          },
        })

        await expect(
          handler(event),
        ).rejects.toMatchObject({
          statusCode: 409,

          data:
            expect.objectContaining({
              code:
                'CRA_SIGNED_SOURCE_REQUIRED',
            }),
        })

        expect(
          scanBufferWithClamAv,
        ).not.toHaveBeenCalled()
      },
    )

    it(
      'bloque un deuxième dépôt tant que le premier attend la vérification IFICS',
      async () => {
        await handler(event)

        await expect(
          handler(event),
        ).rejects.toMatchObject({
          statusCode: 409,

          data:
            expect.objectContaining({
              code:
                'CRA_SIGNED_ALREADY_RECEIVED',
            }),
        })

        expect(
          scanBufferWithClamAv,
        ).toHaveBeenCalledTimes(1)

        expect(
          await prisma.craDocument.count({
            where: {
              reportId,
              type:
                'INTERVENOR_SIGNED',
              status:
                'RECEIVED',
            },
          }),
        ).toBe(1)
      },
    )

    it(
      'refuse un fichier invalide avant tout scan antivirus',
      async () => {
        request.parts = [
          {
            name: 'file',
            filename:
              'faux.pdf',
            type:
              'application/pdf',
            data:
              Buffer.from(
                'ceci n est pas un PDF',
              ),
          },
        ]

        await expect(
          handler(event),
        ).rejects.toMatchObject({
          statusCode: 400,
        })

        expect(
          scanBufferWithClamAv,
        ).not.toHaveBeenCalled()

        expect(
          await countFiles(
            join(
              uploadRoot,
              'quarantine',
            ),
          ),
        ).toBe(0)
      },
    )

    it(
      'refuse les champs multipart supplémentaires',
      async () => {
        request.parts.push({
          name: 'unexpected',
          data:
            Buffer.from('test'),
        })

        await expect(
          handler(event),
        ).rejects.toMatchObject({
          statusCode: 400,

          data:
            expect.objectContaining({
              code:
                'CRA_SIGNED_UNEXPECTED_FIELD',
            }),
        })

        expect(
          scanBufferWithClamAv,
        ).not.toHaveBeenCalled()
      },
    )
  },
)
