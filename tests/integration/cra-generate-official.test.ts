import { createHash, randomUUID } from 'node:crypto'
import {
  readdir,
  stat,
} from 'node:fs/promises'
import { dirname } from 'node:path'
import { defineEventHandler, type H3Event } from 'h3'
import { PDFDocument, StandardFonts } from 'pdf-lib'
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
  userId: 'cra-generator-admin',
  roleCode: 'ADMIN',
  intervenorId: null as string | null,
  permissions: ['*'] as string[],
  body: {} as Record<string, unknown>,
}))

const writeAuditLog = vi.hoisted(() => vi.fn())

vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()

  return {
    ...actual,
    getRouterParam: () => request.reportId,
    readBody: async () => request.body,
  }
})

vi.mock('../../server/utils/auth', () => ({
  requireAuth: async () => ({
    sessionId: 'cra-generator-session',
    userId: request.userId,
    associationId: request.associationId,
    clientId: null,
    intervenorId: request.intervenorId,
    email: 'admin@example.invalid',
    firstName: 'Admin',
    lastName: 'CRA',
    roleCode: request.roleCode,
    roleName: 'Administrateur',
    permissions: request.permissions,
    mfaEnabled: true,
    mfaVerified: true,
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

describe.skipIf(process.env.CRA_INTEGRATION_TESTS !== '1')(
  'Génération du CRA officiel avec PostgreSQL',
  () => {
    let prisma: typeof import('../../server/utils/prisma')['prisma']
    let handler: typeof import('../../server/api/cra/[id]/generate-official.post')['default']
    let readHandler: typeof import('../../server/api/cra/[id]/index.get')['default']

    let reportId: string
    let intervenorId: string
    let projectId: string

    let signature: Awaited<
      ReturnType<
        typeof import('../../server/utils/files')['storeCraSignature']
      >
    >

    let storeCraSignature: typeof import('../../server/utils/files')['storeCraSignature']
    let readStoredFile: typeof import('../../server/utils/files')['readStoredFile']
    let removeStoredFile: typeof import('../../server/utils/files')['removeStoredFile']
    let resolveStoredPath: typeof import('../../server/utils/files')['resolveStoredPath']

    const event = {} as H3Event
    const associationId = `cra-generate-${randomUUID()}`

    async function createSignaturePdf(): Promise<Buffer> {
      const pdf = await PDFDocument.create()
      const page = pdf.addPage([220, 90])
      const font = await pdf.embedFont(
        StandardFonts.HelveticaBold,
      )

      page.drawText('Signature IFICS', {
        x: 18,
        y: 35,
        size: 18,
        font,
      })

      return Buffer.from(await pdf.save())
    }

    async function craStoredFileCount(): Promise<number> {
      const directory = dirname(
        resolveStoredPath(
          `cra/${reportId}/placeholder.pdf`,
        ),
      )

      try {
        const files = await readdir(directory)

        return files.filter(
          name => name.toLowerCase().endsWith('.pdf'),
        ).length
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
    }

    async function cleanupDocuments() {
      const documents = await prisma.craDocument.findMany({
        where: { reportId },
        select: {
          filePath: true,
        },
      })

      for (const document of documents) {
        try {
          await removeStoredFile(document.filePath)
        }
        catch {
          // Nettoyage best effort du fixture de test.
        }
      }

      await prisma.craDocument.deleteMany({
        where: { reportId },
      })
    }

    beforeAll(async () => {
      vi.stubGlobal(
        'defineEventHandler',
        defineEventHandler,
      )

      prisma = (
        await import('../../server/utils/prisma')
      ).prisma

      const files = await import(
        '../../server/utils/files'
      )

      storeCraSignature = files.storeCraSignature
      readStoredFile = files.readStoredFile
      removeStoredFile = files.removeStoredFile
      resolveStoredPath = files.resolveStoredPath

      handler = (
        await import(
          '../../server/api/cra/[id]/generate-official.post'
        )
      ).default

      readHandler = (
        await import(
          '../../server/api/cra/[id]/index.get'
        )
      ).default

      await prisma.association.create({
        data: {
          id: associationId,
          name: 'IFICS',
          legalName: 'IFICS France',
          billingName: 'IFICS France',
          pdfFooter:
            'IFICS France - Compte rendu d’activité officiel',
        },
      })

      const intervenor = await prisma.intervenor.create({
        data: {
          associationId,
          firstName: 'Test',
          lastName: 'Intervenant',
          email: `${associationId}@example.invalid`,
          status: 'ACTIVE',
        },
      })

      intervenorId = intervenor.id

      const project = await prisma.project.create({
        data: {
          associationId,
          reference: 'MISSION-TEST',
          title: 'Mission CRA officielle',
          status: 'IN_PROGRESS',
          classification: 'INTERNAL',

          projectIntervenors: {
            create: {
              intervenorId,
              assignmentStatus: 'ACCEPTED',
            },
          },
        },
      })

      projectId = project.id

      const report = await prisma.craReport.create({
        data: {
          associationId,
          projectId,
          intervenorId,
          year: 2026,
          month: 9,
          status: 'REVIEWED',
          revision: 3,
          reviewedAt: new Date(),
          reviewedById: request.userId,
        },
      })

      reportId = report.id

      await prisma.craDay.createMany({
        data: [
          {
            reportId,
            intervenorId,
            date: new Date(
              '2026-09-01T00:00:00.000Z',
            ),
            dayType: 'WORK',
            durationMinutes: 420,
            comment: 'Développement du module CRA.',
          },
          {
            reportId,
            intervenorId,
            date: new Date(
              '2026-09-02T00:00:00.000Z',
            ),
            dayType: 'TRAINING',
            durationMinutes: 420,
            comment: 'Formation technique.',
          },
          {
            reportId,
            intervenorId,
            date: new Date(
              '2026-09-03T00:00:00.000Z',
            ),
            dayType: 'PAID_LEAVE',
            durationMinutes: 420,
          },
        ],
      })

      signature = await storeCraSignature(
        associationId,
        'signature-test.pdf',
        await createSignaturePdf(),
      )

      await prisma.associationFinanceSettings.create({
        data: {
          associationId,

          craSignatureFilePath:
            signature.filePath,

          craSignatureOriginalName:
            signature.originalName,

          craSignatureMimeType:
            signature.mimeType,

          craSignatureFileSize:
            signature.fileSize,

          craSignatureSha256:
            signature.sha256,

          craSignatureUpdatedByUserId:
            request.userId,

          craSignatureUpdatedAt:
            new Date(),
        },
      })
    })

    beforeEach(async () => {
      await cleanupDocuments()

      await prisma.craReport.update({
        where: {
          id: reportId,
        },
        data: {
          status: 'REVIEWED',
          revision: 3,
          reviewedAt: new Date(),
          reviewedById: request.userId,
        },
      })

      await prisma.associationFinanceSettings.update({
        where: {
          associationId,
        },
        data: {
          craSignatureFilePath:
            signature.filePath,

          craSignatureOriginalName:
            signature.originalName,

          craSignatureMimeType:
            signature.mimeType,

          craSignatureFileSize:
            signature.fileSize,

          craSignatureSha256:
            signature.sha256,

          craSignatureUpdatedByUserId:
            request.userId,

          craSignatureUpdatedAt:
            new Date(),
        },
      })

      request.reportId = reportId
      request.associationId = associationId
      request.roleCode = 'ADMIN'
      request.intervenorId = null
      request.permissions = ['*']
      request.body = {
        confirmed: true,
        revision: 3,
      }

      writeAuditLog.mockReset()
    })

    afterAll(async () => {
      try {
        if (prisma) {
          await cleanupDocuments()

          await prisma.associationFinanceSettings.deleteMany({
            where: {
              associationId,
            },
          })

          await prisma.craDay.deleteMany({
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
              id: intervenorId,
            },
          })

          if (signature?.filePath) {
            try {
              await removeStoredFile(
                signature.filePath,
              )
            }
            catch {
              // Déjà nettoyé.
            }
          }

          await prisma.association.deleteMany({
            where: {
              id: associationId,
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

    it('refuse sans CRA_READ_ALL', async () => {
      request.permissions = ['cra:manage']

      await expect(
        handler(event),
      ).rejects.toMatchObject({
        statusCode: 403,
      })
    })

    it('refuse sans CRA_MANAGE', async () => {
      request.permissions = ['cra:read:all']

      await expect(
        handler(event),
      ).rejects.toMatchObject({
        statusCode: 403,
      })
    })

    it('refuse un CRA non vérifié', async () => {
      await prisma.craReport.update({
        where: { id: reportId },
        data: {
          status: 'SUBMITTED',
        },
      })

      await expect(
        handler(event),
      ).rejects.toMatchObject({
        statusCode: 409,
        data: expect.objectContaining({
          code: 'CRA_NOT_REVIEWED',
        }),
      })
    })

    it('refuse une révision périmée', async () => {
      request.body = {
        confirmed: true,
        revision: 2,
      }

      await expect(
        handler(event),
      ).rejects.toMatchObject({
        statusCode: 409,
        data: expect.objectContaining({
          code: 'CRA_GENERATION_CONFLICT',
        }),
      })
    })

    it('refuse sans signature officielle configurée', async () => {
      await prisma.associationFinanceSettings.update({
        where: {
          associationId,
        },
        data: {
          craSignatureFilePath: null,
          craSignatureOriginalName: null,
          craSignatureMimeType: null,
          craSignatureFileSize: null,
          craSignatureSha256: null,
          craSignatureUpdatedByUserId: null,
          craSignatureUpdatedAt: null,
        },
      })

      await expect(
        handler(event),
      ).rejects.toMatchObject({
        statusCode: 409,
        data: expect.objectContaining({
          code: 'CRA_SIGNATURE_REQUIRED',
        }),
      })
    })

    it('génère une V1 privée, hashée et auditée', async () => {
      const result = await handler(event)

      expect(result.data).toMatchObject({
        reportId,
        type: 'IFICS_TO_SIGN',
        status: 'GENERATED',
        version: 1,
        reportRevision: 3,
        antivirusStatus: 'NOT_APPLICABLE',
      })

      expect(result.data.reference)
        .toMatch(/^CRA-2026-09-[A-Z0-9]{8}-V1$/)

      const document
        = await prisma.craDocument.findUniqueOrThrow({
          where: {
            id: result.data.id,
          },
        })

      expect(document.filePath)
        .toMatch(
          new RegExp(
            `^cra/${reportId}/[^/]+\\.pdf$`,
          ),
        )

      expect(document.filePath)
        .not.toContain('..')

      const bytes = await readStoredFile(
        document.filePath,
      )

      const sha256 = createHash('sha256')
        .update(bytes)
        .digest('hex')

      expect(document.sha256).toBe(sha256)
      expect(Number(document.fileSize))
        .toBe(bytes.length)

      const fileStat = await stat(
        resolveStoredPath(
          document.filePath,
        ),
      )

      expect(fileStat.mode & 0o777).toBe(0o640)

      expect(writeAuditLog)
        .toHaveBeenCalledTimes(1)

      expect(writeAuditLog)
        .toHaveBeenCalledWith(
          event,
          expect.anything(),
          expect.objectContaining({
            action:
              'CRA_OFFICIAL_DOCUMENT_GENERATED',

            entityType:
              'CraDocument',

            entityId:
              document.id,

            metadata:
              expect.objectContaining({
                reportId,
                version: 1,
                reference:
                  document.reference,
                sha256:
                  document.sha256,
              }),
          }),
        )
    })

    it('crée explicitement V2 et conserve V1 immuable', async () => {
      const first = await handler(event)

      const firstDocument
        = await prisma.craDocument.findUniqueOrThrow({
          where: {
            id: first.data.id,
          },
        })

      const firstBytes
        = await readStoredFile(
          firstDocument.filePath,
        )

      const firstSha256
        = createHash('sha256')
          .update(firstBytes)
          .digest('hex')

      const second = await handler(event)

      expect(second.data).toMatchObject({
        reportId,
        type: 'IFICS_TO_SIGN',
        status: 'GENERATED',
        version: 2,
        reportRevision: 3,
      })

      expect(second.data.reference)
        .toMatch(/^CRA-2026-09-[A-Z0-9]{8}-V2$/)

      const documents
        = await prisma.craDocument.findMany({
          where: {
            reportId,
            type: 'IFICS_TO_SIGN',
          },
          orderBy: {
            version: 'asc',
          },
        })

      expect(documents).toHaveLength(2)

      expect(documents[0]).toMatchObject({
        id: firstDocument.id,
        version: 1,
        status: 'SUPERSEDED',
      })

      expect(documents[0]!.archivedAt)
        .not.toBeNull()

      expect(documents[1]).toMatchObject({
        id: second.data.id,
        version: 2,
        status: 'GENERATED',
      })

      expect(documents[1]!.archivedAt)
        .toBeNull()

      const preservedBytes
        = await readStoredFile(
          documents[0]!.filePath,
        )

      const preservedSha256
        = createHash('sha256')
          .update(preservedBytes)
          .digest('hex')

      expect(preservedSha256)
        .toBe(firstSha256)

      expect(documents[0]!.sha256)
        .toBe(firstSha256)

      expect(documents[0]!.filePath)
        .not.toBe(documents[1]!.filePath)
    })

    it('supprime le PDF si la transaction DB échoue', async () => {
      const before = await craStoredFileCount()

      const transactionSpy = vi.spyOn(
        prisma,
        '$transaction',
      )

      transactionSpy.mockRejectedValueOnce(
        new Error('CRA_DB_FAILURE_TEST'),
      )

      try {
        await expect(
          handler(event),
        ).rejects.toThrow(
          'CRA_DB_FAILURE_TEST',
        )
      }
      finally {
        transactionSpy.mockRestore()
      }

      const after = await craStoredFileCount()

      expect(after).toBe(before)

      expect(
        await prisma.craDocument.count({
          where: { reportId },
        }),
      ).toBe(0)

      expect(writeAuditLog)
        .not.toHaveBeenCalled()
    })

    it('retourne au lecteur global uniquement les métadonnées sûres du dernier document officiel', async () => {
      const generated = await handler(event)

      const result = await readHandler(event)

      expect(result.data.officialDocument).toMatchObject({
        id: generated.data.id,
        type: 'IFICS_TO_SIGN',
        status: 'GENERATED',
        version: 1,
        reportRevision: 3,
        reference: generated.data.reference,
      })

      expect(result.data.officialDocument)
        .not.toHaveProperty('filePath')

      expect(result.data.officialDocument)
        .not.toHaveProperty('storedName')

      expect(result.data.officialDocument)
        .not.toHaveProperty('sha256')

      expect(result.data.officialDocument)
        .not.toHaveProperty('fileSize')
    })

    it('masque le document officiel en lecture personnelle', async () => {
      await handler(event)

      request.roleCode = 'INTERVENOR'
      request.intervenorId = intervenorId
      request.permissions = ['cra:read:own']

      const result = await readHandler(event)

      expect(result.data.officialDocument).toBeNull()
    })

    it('transforme une collision de version Prisma en HTTP 409 et nettoie le PDF', async () => {
      const before = await craStoredFileCount()

      const prismaConflict = Object.assign(
        new Error('Unique constraint failed'),
        {
          code: 'P2002',
        },
      )

      const transactionSpy = vi.spyOn(
        prisma,
        '$transaction',
      )

      transactionSpy.mockRejectedValueOnce(
        prismaConflict,
      )

      try {
        await expect(
          handler(event),
        ).rejects.toMatchObject({
          statusCode: 409,
          data: expect.objectContaining({
            code: 'CRA_GENERATION_CONFLICT',
          }),
        })
      }
      finally {
        transactionSpy.mockRestore()
      }

      const after = await craStoredFileCount()

      expect(after).toBe(before)

      expect(
        await prisma.craDocument.count({
          where: { reportId },
        }),
      ).toBe(0)

      expect(writeAuditLog)
        .not.toHaveBeenCalled()
    })
  },
)
