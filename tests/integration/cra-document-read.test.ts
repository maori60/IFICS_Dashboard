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

const request = vi.hoisted(() => ({
  reportId: '',
  documentId: '',
  associationId: '',
  permissions: ['cra:read:all'] as string[],
  query: {} as Record<string, unknown>,
  headers: {} as Record<string, string>,
}))

vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()

  return {
    ...actual,

    getRouterParam: (
      _event: H3Event,
      name: string,
    ) =>
      name === 'documentId'
        ? request.documentId
        : request.reportId,

    getQuery: () => request.query,

    setResponseHeader: (
      _event: H3Event,
      name: string,
      value: unknown,
    ) => {
      request.headers[name] = String(value)
    },
  }
})

vi.mock('../../server/utils/auth', () => ({
  requireAuth: async () => ({
    sessionId: 'cra-document-session',
    userId: 'cra-document-admin',
    associationId: request.associationId,
    clientId: null,
    intervenorId: null,
    email: 'admin@example.invalid',
    firstName: 'Admin',
    lastName: 'CRA',
    roleCode: 'ADMIN',
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

describe.skipIf(
  process.env.CRA_INTEGRATION_TESTS !== '1',
)(
  'Lecture sécurisée des documents CRA avec PostgreSQL',
  () => {
    let prisma:
      typeof import('../../server/utils/prisma')['prisma']

    let handler:
      typeof import(
        '../../server/api/cra/[id]/documents/[documentId].get'
      )['default']

    let storePdf:
      typeof import('../../server/utils/files')['storePdf']

    let readStoredFile:
      typeof import('../../server/utils/files')['readStoredFile']

    let removeStoredFile:
      typeof import('../../server/utils/files')['removeStoredFile']

    let resolveStoredPath:
      typeof import('../../server/utils/files')['resolveStoredPath']

    let intervenorId: string
    let firstReportId: string
    let secondReportId: string
    let documentId: string

    const event = {} as H3Event
    const associationId
      = `cra-document-${randomUUID()}`

    async function createPdf(): Promise<Buffer> {
      const pdf = await PDFDocument.create()
      const page = pdf.addPage([300, 180])

      const font = await pdf.embedFont(
        StandardFonts.Helvetica,
      )

      page.drawText('CRA IFICS test document', {
        x: 30,
        y: 100,
        size: 16,
        font,
      })

      return Buffer.from(await pdf.save())
    }

    async function cleanupDocuments(): Promise<void> {
      const documents = await prisma.craDocument.findMany({
        where: {
          report: {
            associationId,
          },
        },
        select: {
          filePath: true,
        },
      })

      for (const document of documents) {
        try {
          await removeStoredFile(document.filePath)
        }
        catch {
          // Nettoyage best effort du fixture.
        }
      }

      await prisma.craDocument.deleteMany({
        where: {
          report: {
            associationId,
          },
        },
      })
    }

    async function createOfficialDocument() {
      const bytes = await createPdf()

      const stored = await storePdf(
        'cra',
        firstReportId,
        'CRA-document-test.pdf',
        bytes,
      )

      const document = await prisma.craDocument.create({
        data: {
          reportId: firstReportId,
          type: 'IFICS_TO_SIGN',
          status: 'GENERATED',
          version: 1,
          reportRevision: 1,

          reference:
            `CRA-DOCUMENT-${randomUUID()
              .replaceAll('-', '')
              .slice(0, 12)
              .toUpperCase()}`,

          ...stored,

          antivirusStatus: 'NOT_APPLICABLE',
          antivirusCheckedAt: new Date(),
          antivirusResult:
            'Document de test généré en interne.',
        },
      })

      documentId = document.id
      request.documentId = document.id

      return document
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

      storePdf = files.storePdf
      readStoredFile = files.readStoredFile
      removeStoredFile = files.removeStoredFile
      resolveStoredPath = files.resolveStoredPath

      handler = (
        await import(
          '../../server/api/cra/[id]/documents/[documentId].get'
        )
      ).default

      await prisma.association.create({
        data: {
          id: associationId,
          name: 'IFICS test document CRA',
        },
      })

      const intervenor = await prisma.intervenor.create({
        data: {
          associationId,
          firstName: 'Test',
          lastName: 'Document',
          email:
            `${associationId}@example.invalid`,
          status: 'ACTIVE',
        },
      })

      intervenorId = intervenor.id

      const reportIds: string[] = []

      for (const title of [
        'Mission document A',
        'Mission document B',
      ]) {
        const project = await prisma.project.create({
          data: {
            associationId,
            title,
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

        const report = await prisma.craReport.create({
          data: {
            associationId,
            projectId: project.id,
            intervenorId,
            year: 2026,
            month: 9,
            status: 'REVIEWED',
          },
        })

        reportIds.push(report.id)
      }

      firstReportId = reportIds[0]!
      secondReportId = reportIds[1]!
    })

    beforeEach(async () => {
      await cleanupDocuments()

      documentId = ''

      request.reportId = firstReportId
      request.documentId = ''
      request.associationId = associationId
      request.permissions = [
        'cra:read:all',
      ]
      request.query = {}
      request.headers = {}

      await createOfficialDocument()
    })

    afterAll(async () => {
      try {
        if (prisma) {
          await cleanupDocuments()

          await prisma.craReport.deleteMany({
            where: {
              associationId,
            },
          })

          await prisma.projectIntervenor.deleteMany({
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

          await prisma.intervenor.deleteMany({
            where: {
              id: intervenorId,
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
        vi.unstubAllGlobals()

        if (prisma) {
          await prisma.$disconnect()
        }
      }
    })

    it('sert le PDF officiel en lecture inline', async () => {
      const buffer = await handler(event)

      expect(Buffer.isBuffer(buffer)).toBe(true)

      expect(
        buffer.subarray(0, 5).toString(),
      ).toBe('%PDF-')

      expect(request.headers).toMatchObject({
        'Content-Type':
          'application/pdf',

        'Content-Disposition':
          'inline; filename="CRA-document-test.pdf"',

        'Cache-Control':
          'private, no-store, max-age=0',

        'X-Content-Type-Options':
          'nosniff',
      })

      expect(
        Number(
          request.headers['Content-Length'],
        ),
      ).toBe(buffer.length)

      const document
        = await prisma.craDocument.findUniqueOrThrow({
          where: {
            id: documentId,
          },
          select: {
            filePath: true,
          },
        })

      const stored = await readStoredFile(
        document.filePath,
      )

      expect(
        Buffer.compare(buffer, stored),
      ).toBe(0)
    })

    it('sert le même PDF en téléchargement attachment', async () => {
      request.query = {
        download: '1',
      }

      const buffer = await handler(event)

      expect(Buffer.isBuffer(buffer)).toBe(true)

      expect(
        request.headers['Content-Disposition'],
      ).toBe(
        'attachment; filename="CRA-document-test.pdf"',
      )
    })

    it('refuse sans permission CRA_READ_ALL', async () => {
      request.permissions = [
        'cra:manage',
      ]

      await expect(
        handler(event),
      ).rejects.toMatchObject({
        statusCode: 403,

        data: expect.objectContaining({
          code: 'CRA_DOCUMENT_FORBIDDEN',
        }),
      })
    })

    it('masque le document depuis un autre CRA', async () => {
      request.reportId = secondReportId

      await expect(
        handler(event),
      ).rejects.toMatchObject({
        statusCode: 404,

        data: expect.objectContaining({
          code: 'CRA_DOCUMENT_NOT_FOUND',
        }),
      })
    })

    it('masque le document pour une autre association', async () => {
      request.associationId
        = 'association-non-autorisee'

      await expect(
        handler(event),
      ).rejects.toMatchObject({
        statusCode: 404,

        data: expect.objectContaining({
          code: 'CRA_DOCUMENT_NOT_FOUND',
        }),
      })
    })

    it('bloque un fichier physique dont la taille a changé', async () => {
      const document
        = await prisma.craDocument.findUniqueOrThrow({
          where: {
            id: documentId,
          },
          select: {
            filePath: true,
          },
        })

      const bytes = await readStoredFile(
        document.filePath,
      )

      await writeFile(
        resolveStoredPath(document.filePath),
        Buffer.concat([
          bytes,
          Buffer.from([0x00]),
        ]),
      )

      await expect(
        handler(event),
      ).rejects.toMatchObject({
        statusCode: 409,

        data: expect.objectContaining({
          code: 'CRA_DOCUMENT_SIZE_MISMATCH',
        }),
      })
    })

    it('bloque un fichier physique altéré malgré une taille identique', async () => {
      const document
        = await prisma.craDocument.findUniqueOrThrow({
          where: {
            id: documentId,
          },
          select: {
            filePath: true,
          },
        })

      const bytes = await readStoredFile(
        document.filePath,
      )

      const altered = Buffer.from(bytes)

      const position = Math.min(
        20,
        altered.length - 1,
      )

      altered[position]
        = altered[position] === 0
          ? 1
          : altered[position] ^ 0x01

      await writeFile(
        resolveStoredPath(document.filePath),
        altered,
      )

      expect(altered.length).toBe(bytes.length)

      await expect(
        handler(event),
      ).rejects.toMatchObject({
        statusCode: 409,

        data: expect.objectContaining({
          code: 'CRA_DOCUMENT_HASH_MISMATCH',
        }),
      })
    })
  },
)
