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
  associationId: '',
  permissions: [
    'cra:read:all',
    'cra:manage',
  ] as string[],
  body: {} as Record<string, unknown>,
}))

const mail = vi.hoisted(() => ({
  enabled: true,

  send: vi.fn(async () => ({
    delivered: true,
    messageId: '<cra-test@example.invalid>',
  })),
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
      request.reportId,

    readBody: async () =>
      request.body,
  }
})

vi.mock('../../server/utils/auth', () => ({
  requireAuth: async () => ({
    sessionId: 'cra-send-session',
    userId: 'cra-send-admin',
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

vi.mock('../../server/utils/mail', () => ({
  isMailEnabled: () =>
    mail.enabled,

  sendMailDetailed: mail.send,
}))

vi.mock('../../server/utils/audit', () => ({
  writeAuditLog,
}))

describe.skipIf(
  process.env.CRA_INTEGRATION_TESTS !== '1',
)(
  'Envoi du CRA officiel à l’intervenant avec PostgreSQL',
  () => {
    let prisma:
      typeof import('../../server/utils/prisma')['prisma']

    let handler:
      typeof import(
        '../../server/api/cra/[id]/send-to-intervenor.post'
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
    let reportId: string
    let documentId: string
    let expectedPdf: Buffer

    const event = {} as H3Event

    const associationId
      = `cra-send-${randomUUID()}`

    async function createPdf(): Promise<Buffer> {
      const pdf = await PDFDocument.create()

      const page = pdf.addPage([
        360,
        220,
      ])

      const font = await pdf.embedFont(
        StandardFonts.Helvetica,
      )

      page.drawText(
        'CRA officiel IFICS - test envoi',
        {
          x: 30,
          y: 120,
          size: 14,
          font,
        },
      )

      return Buffer.from(
        await pdf.save(),
      )
    }

    async function cleanupDocuments() {
      const documents
        = await prisma.craDocument.findMany({
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
          await removeStoredFile(
            document.filePath,
          )
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
      expectedPdf = await createPdf()

      const stored = await storePdf(
        'cra',
        reportId,
        'CRA-TEST-ENVOI-V1.pdf',
        expectedPdf,
      )

      const document
        = await prisma.craDocument.create({
          data: {
            reportId,
            type: 'IFICS_TO_SIGN',
            status: 'GENERATED',
            version: 1,
            reportRevision: 3,

            reference:
              `CRA-SEND-${randomUUID()
                .replaceAll('-', '')
                .slice(0, 12)
                .toUpperCase()}`,

            ...stored,

            generatedByUserId:
              'cra-send-admin',

            antivirusStatus:
              'NOT_APPLICABLE',

            antivirusCheckedAt:
              new Date(),

            antivirusResult:
              'Document de test généré en interne.',
          },
        })

      documentId = document.id

      return document
    }

    async function documentSnapshot() {
      return prisma.craDocument
        .findUniqueOrThrow({
          where: {
            id: documentId,
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

      const files = await import(
        '../../server/utils/files'
      )

      storePdf = files.storePdf
      readStoredFile = files.readStoredFile
      removeStoredFile = files.removeStoredFile
      resolveStoredPath = files.resolveStoredPath

      handler = (
        await import(
          '../../server/api/cra/[id]/send-to-intervenor.post'
        )
      ).default

      await prisma.association.create({
        data: {
          id: associationId,
          name: 'IFICS test envoi CRA',
        },
      })

      const intervenor
        = await prisma.intervenor.create({
          data: {
            associationId,
            firstName: 'Jean',
            lastName: 'Intervenant',
            email:
              `${associationId}@example.invalid`,
            status: 'ACTIVE',
          },
        })

      intervenorId = intervenor.id

      const project
        = await prisma.project.create({
          data: {
            associationId,
            reference: 'MISSION-SEND',
            title: 'Mission test envoi CRA',
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

      const report
        = await prisma.craReport.create({
          data: {
            associationId,
            projectId: project.id,
            intervenorId,
            year: 2026,
            month: 9,
            status: 'REVIEWED',
            revision: 3,
            reviewedAt: new Date(),
            reviewedById:
              'cra-send-admin',
          },
        })

      reportId = report.id
    })

    beforeEach(async () => {
      await cleanupDocuments()

      request.reportId = reportId
      request.associationId = associationId

      request.permissions = [
        'cra:read:all',
        'cra:manage',
      ]

      request.body = {
        to: 'signature@example.invalid',

        subject:
          'CRA septembre 2026 à signer',

        message:
          'Bonjour,\n\nVeuillez trouver en pièce jointe votre CRA à signer puis à retourner à IFICS.',

        confirmed: true,
      }

      mail.enabled = true

      mail.send.mockReset()

      mail.send.mockResolvedValue({
        delivered: true,
        messageId:
          '<cra-test@example.invalid>',
      })

      writeAuditLog.mockReset()

      await prisma.craReport.update({
        where: {
          id: reportId,
        },

        data: {
          status: 'REVIEWED',
          revision: 3,
        },
      })

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

    it('envoie exactement le PDF immuable en pièce jointe', async () => {
      const result = await handler(event)

      expect(result.data).toMatchObject({
        documentId,
        version: 1,
        status: 'SENT_TO_INTERVENOR',
        recipient:
          'signature@example.invalid',
      })

      expect(mail.send)
        .toHaveBeenCalledTimes(1)

      const sentMessage
        = mail.send.mock.calls[0]![0]

      expect(sentMessage).toMatchObject({
        from:
          'IFICS - CRA <cra@ifics.org>',

        replyTo:
          'cra@ifics.org',

        to: 'signature@example.invalid',

        subject:
          'CRA septembre 2026 à signer',

        text:
          'Bonjour,\n\nVeuillez trouver en pièce jointe votre CRA à signer puis à retourner à IFICS.',
      })

      expect(
        sentMessage.attachments,
      ).toHaveLength(1)

      const attachment
        = sentMessage.attachments![0]!

      expect(attachment.filename)
        .toBe('CRA-TEST-ENVOI-V1.pdf')

      expect(attachment.contentType)
        .toBe('application/pdf')

      expect(
        Buffer.compare(
          attachment.content,
          expectedPdf,
        ),
      ).toBe(0)

      const stored
        = await readStoredFile(
          (await documentSnapshot()).filePath,
        )

      expect(
        Buffer.compare(
          attachment.content,
          stored,
        ),
      ).toBe(0)

      const document
        = await documentSnapshot()

      expect(document.status)
        .toBe('SENT_TO_INTERVENOR')

      expect(document.sentToIntervenorAt)
        .not.toBeNull()

      expect(writeAuditLog)
        .toHaveBeenCalledTimes(1)

      expect(writeAuditLog)
        .toHaveBeenCalledWith(
          event,
          expect.any(Object),
          expect.objectContaining({
            action:
              'CRA_OFFICIAL_DOCUMENT_SENT_TO_INTERVENOR',

            entityType:
              'CraDocument',

            entityId:
              documentId,

            metadata:
              expect.objectContaining({
                recipient:
                  'signature@example.invalid',

                messageId:
                  '<cra-test@example.invalid>',

                resend: false,
              }),
          }),
        )
    })

    it('refuse sans CRA_MANAGE et ne modifie pas le document', async () => {
      request.permissions = [
        'cra:read:all',
      ]

      await expect(
        handler(event),
      ).rejects.toMatchObject({
        statusCode: 403,

        data: expect.objectContaining({
          code:
            'CRA_SEND_INTERVENOR_FORBIDDEN',
        }),
      })

      expect(mail.send)
        .not.toHaveBeenCalled()

      const document
        = await documentSnapshot()

      expect(document.status)
        .toBe('GENERATED')

      expect(document.sentToIntervenorAt)
        .toBeNull()

      expect(writeAuditLog)
        .not.toHaveBeenCalled()
    })

    it('masque le CRA pour une autre association', async () => {
      request.associationId
        = 'association-non-autorisee'

      await expect(
        handler(event),
      ).rejects.toMatchObject({
        statusCode: 404,

        data: expect.objectContaining({
          code: 'CRA_NOT_FOUND',
        }),
      })

      expect(mail.send)
        .not.toHaveBeenCalled()

      expect(
        (await documentSnapshot()).status,
      ).toBe('GENERATED')
    })

    it('refuse lorsque le service SMTP est désactivé sans changer le statut', async () => {
      mail.enabled = false

      await expect(
        handler(event),
      ).rejects.toMatchObject({
        statusCode: 503,

        data: expect.objectContaining({
          code: 'MAIL_DISABLED',
        }),
      })

      expect(mail.send)
        .not.toHaveBeenCalled()

      const document
        = await documentSnapshot()

      expect(document.status)
        .toBe('GENERATED')

      expect(document.sentToIntervenorAt)
        .toBeNull()

      expect(writeAuditLog)
        .not.toHaveBeenCalled()
    })

    it('conserve GENERATED lorsque le serveur SMTP échoue', async () => {
      mail.send.mockRejectedValueOnce(
        new Error('SMTP_TEST_FAILURE'),
      )

      await expect(
        handler(event),
      ).rejects.toMatchObject({
        statusCode: 502,

        data: expect.objectContaining({
          code:
            'CRA_SEND_INTERVENOR_MAIL_FAILED',
        }),
      })

      const document
        = await documentSnapshot()

      expect(document.status)
        .toBe('GENERATED')

      expect(document.sentToIntervenorAt)
        .toBeNull()

      expect(writeAuditLog)
        .not.toHaveBeenCalled()
    })

    it('conserve GENERATED lorsque le transport indique que le mail n’a pas été livré', async () => {
      mail.send.mockResolvedValueOnce({
        delivered: false,
        messageId: null,
      })

      await expect(
        handler(event),
      ).rejects.toMatchObject({
        statusCode: 503,

        data: expect.objectContaining({
          code:
            'CRA_SEND_INTERVENOR_NOT_DELIVERED',
        }),
      })

      const document
        = await documentSnapshot()

      expect(document.status)
        .toBe('GENERATED')

      expect(document.sentToIntervenorAt)
        .toBeNull()

      expect(writeAuditLog)
        .not.toHaveBeenCalled()
    })

    it('bloque un PDF physiquement altéré avant tout envoi', async () => {
      const document
        = await documentSnapshot()

      const bytes
        = await readStoredFile(
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

      expect(altered.length)
        .toBe(bytes.length)

      await writeFile(
        resolveStoredPath(
          document.filePath,
        ),
        altered,
      )

      await expect(
        handler(event),
      ).rejects.toMatchObject({
        statusCode: 409,

        data: expect.objectContaining({
          code:
            'CRA_DOCUMENT_HASH_MISMATCH',
        }),
      })

      expect(mail.send)
        .not.toHaveBeenCalled()

      const after
        = await documentSnapshot()

      expect(after.status)
        .toBe('GENERATED')

      expect(after.sentToIntervenorAt)
        .toBeNull()
    })

    it('autorise le renvoi du même document immuable et l’audite comme renvoi', async () => {
      await handler(event)

      writeAuditLog.mockReset()

      mail.send.mockClear()

      request.body = {
        ...request.body,
        to: 'nouvelle-adresse@example.invalid',
      }

      const result
        = await handler(event)

      expect(result.data).toMatchObject({
        documentId,
        status:
          'SENT_TO_INTERVENOR',

        recipient:
          'nouvelle-adresse@example.invalid',
      })

      expect(mail.send)
        .toHaveBeenCalledTimes(1)

      const sentMessage
        = mail.send.mock.calls[0]![0]

      expect(sentMessage.to)
        .toBe(
          'nouvelle-adresse@example.invalid',
        )

      expect(
        Buffer.compare(
          sentMessage.attachments![0]!.content,
          expectedPdf,
        ),
      ).toBe(0)

      expect(writeAuditLog)
        .toHaveBeenCalledWith(
          event,
          expect.any(Object),
          expect.objectContaining({
            action:
              'CRA_OFFICIAL_DOCUMENT_RESENT_TO_INTERVENOR',

            entityId:
              documentId,

            metadata:
              expect.objectContaining({
                recipient:
                  'nouvelle-adresse@example.invalid',

                resend: true,
              }),
          }),
        )
    })
  },
)
