import { randomUUID } from 'node:crypto'
import {
  writeFile,
} from 'node:fs/promises'
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
    'cra:send:client',
  ] as string[],
  body: {} as Record<string, unknown>,
}))

const mail = vi.hoisted(() => ({
  enabled: true,

  send: vi.fn(async () => ({
    delivered: true,
    messageId:
      '<cra-client-test@example.invalid>',
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
    sessionId:
      'cra-send-client-session',

    userId:
      'cra-send-client-admin',

    associationId:
      request.associationId,

    clientId: null,
    intervenorId: null,

    email:
      'admin@example.invalid',

    firstName:
      'Admin',

    lastName:
      'CRA',

    roleCode:
      'ADMIN',

    roleName:
      'Administrateur',

    permissions:
      request.permissions,

    mfaEnabled: true,
    mfaVerified: true,
    mfaSetupRequired: false,
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

vi.mock('../../server/utils/mail', () => ({
  isMailEnabled: () =>
    mail.enabled,

  sendMailDetailed:
    mail.send,
}))

vi.mock('../../server/utils/audit', () => ({
  writeAuditLog,
}))

describe.skipIf(
  process.env.CRA_INTEGRATION_TESTS !== '1',
)(
  'Envoi sécurisé du CRA signé au client avec PostgreSQL',
  () => {
    let prisma:
      typeof import(
        '../../server/utils/prisma'
      )['prisma']

    let handler:
      typeof import(
        '../../server/api/cra/[id]/send-to-client.post'
      )['default']

    let storePdf:
      typeof import(
        '../../server/utils/files'
      )['storePdf']

    let removeStoredFile:
      typeof import(
        '../../server/utils/files'
      )['removeStoredFile']

    let resolveStoredPath:
      typeof import(
        '../../server/utils/files'
      )['resolveStoredPath']

    let hashToken:
      typeof import(
        '../../server/utils/security'
      )['hashToken']

    let reportId: string
    let projectId: string
    let intervenorId: string
    let clientId: string
    let clientContactId: string
    let documentId: string

    const event = {} as H3Event

    const associationId
      = `cra-send-client-${randomUUID()}`

    const clientEmail
      = 'client@example.invalid'

    const contactEmail
      = 'responsable.client@example.invalid'

    async function createPdf():
      Promise<Buffer> {
      const pdf = await PDFDocument.create()

      const page = pdf.addPage([
        360,
        220,
      ])

      const font = await pdf.embedFont(
        StandardFonts.Helvetica,
      )

      page.drawText(
        'CRA signe IFICS - test client',
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
      /*
       * Sécurité critique :
       * ne jamais nettoyer à partir de reportId,
       * documentId ou d'un identifiant créé dans
       * beforeAll car ils peuvent être undefined
       * si la préparation du test échoue.
       */
      if (
        !associationId.startsWith(
          'cra-send-client-',
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
        /*
         * Les chemins proviennent uniquement
         * de documents appartenant aux CRA
         * de l'association aléatoire du test.
         */
        if (
          !filePath.startsWith(
            'cra/',
          )
        ) {
          continue
        }

        try {
          await removeStoredFile(
            filePath,
          )
        }
        catch {
          // Nettoyage physique best effort.
        }
      }
    }

    async function createSignedDocument() {
      const pdf = await createPdf()

      const stored = await storePdf(
        'cra',
        reportId,
        'CRA-CLIENT-SIGNED-V1.pdf',
        pdf,
      )

      const document
        = await prisma.craDocument.create({
          data: {
            reportId,

            type:
              'INTERVENOR_SIGNED',

            status:
              'APPROVED',

            version: 1,

            reportRevision: 4,

            reference:
              `CRA-CLIENT-${randomUUID()
                .replaceAll('-', '')
                .slice(0, 12)
                .toUpperCase()}-SIGNED-V1`,

            ...stored,

            uploadedByUserId:
              'cra-test-intervenor',

            reviewedByUserId:
              'cra-send-client-admin',

            reviewedAt:
              new Date(),

            receivedAt:
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

      return document
    }

    async function createExistingAccess() {
      return prisma.craClientAccess.create({
        data: {
          reportId,
          documentId,

          purpose:
            'INITIAL_CONFIRMATION',

          status:
            'ACTIVE',

          tokenHash:
            hashToken(
              `old-${randomUUID()}`,
            ),

          recipientEmail:
            contactEmail,

          createdByUserId:
            'cra-send-client-admin',

          expiresAt:
            new Date(
              Date.now()
              + 24 * 60 * 60 * 1000,
            ),

          emailSentAt:
            new Date(),
        },
      })
    }

    beforeAll(async () => {
      vi.stubGlobal(
        'defineEventHandler',
        defineEventHandler,
      )

      process.env.APP_BASE_URL
        = 'https://ifics.example.test'

      prisma = (
        await import(
          '../../server/utils/prisma'
        )
      ).prisma

      const files = await import(
        '../../server/utils/files'
      )

      storePdf = files.storePdf
      removeStoredFile
        = files.removeStoredFile
      resolveStoredPath
        = files.resolveStoredPath

      hashToken = (
        await import(
          '../../server/utils/security'
        )
      ).hashToken

      handler = (
        await import(
          '../../server/api/cra/[id]/send-to-client.post'
        )
      ).default

      await prisma.association.create({
        data: {
          id: associationId,
          name:
            'IFICS test envoi client',
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

      const client
        = await prisma.client.create({
          data: {
            associationId,
            type: 'AUTRE',
            status: 'ACTIVE',

            name:
              'Client test CRA',

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
                  'Client',

                email:
                  contactEmail,

                jobTitle:
                  'Responsable',

                isPrimary: true,
              },
            },
          },

          include: {
            contacts: true,
          },
        })

      clientId = client.id

      clientContactId
        = client.contacts[0]!.id

      const project
        = await prisma.project.create({
          data: {
            associationId,

            reference:
              'MISSION-CLIENT',

            title:
              'Mission test CRA client',

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
                clientId,
                isMainClient: true,
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

            revision: 4,

            reviewedAt:
              new Date(),

            reviewedById:
              'cra-send-client-admin',
          },
        })

      reportId = report.id
    })

    beforeEach(async () => {
      await cleanupDocuments()

      request.reportId = reportId
      request.associationId
        = associationId

      request.permissions = [
        'cra:read:all',
        'cra:send:client',
      ]

      request.body = {
        to: contactEmail,

        subject:
          'CRA septembre 2026 à confirmer',

        message:
          'Bonjour,\n\nVeuillez consulter le CRA signé et confirmer sa réception.',

        confirmed: true,
      }

      mail.enabled = true

      mail.send.mockReset()

      mail.send.mockResolvedValue({
        delivered: true,

        messageId:
          '<cra-client-test@example.invalid>',
      })

      writeAuditLog.mockReset()

      await prisma.craReport.update({
        where: {
          id: reportId,
        },

        data: {
          status:
            'REVIEWED',

          revision: 4,
        },
      })

      await createSignedDocument()
    })

    afterAll(async () => {
      try {
        if (prisma) {
          if (
            !associationId.startsWith(
              'cra-send-client-',
            )
          ) {
            throw new Error(
              'Refus du nettoyage : association de test invalide.',
            )
          }

          await cleanupDocuments()

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
      }
      finally {
        delete process.env.APP_BASE_URL

        vi.unstubAllGlobals()

        if (prisma) {
          await prisma.$disconnect()
        }
      }
    })


    it(
      'envoie un lien opaque et ne stocke que son hash',
      async () => {
        const before = Date.now()

        const result
          = await handler(event)

        expect(result.data).toMatchObject({
          documentId,
          recipient:
            contactEmail,

          purpose:
            'INITIAL_CONFIRMATION',

          status:
            'ACTIVE',
        })

        expect(mail.send)
          .toHaveBeenCalledTimes(1)

        const sentMessage
          = mail.send.mock.calls[0]![0]

        expect(sentMessage.to)
          .toBe(contactEmail)

        expect(
          sentMessage.attachments,
        ).toBeUndefined()

        const match
          = sentMessage.text.match(
            /https:\/\/ifics\.example\.test\/cra\/client#token=([A-Za-z0-9_-]+)/,
          )

        expect(match).not.toBeNull()

        const token = match![1]!

        expect(token.length)
          .toBeGreaterThanOrEqual(40)

        const access
          = await prisma.craClientAccess
            .findUnique({
              where: {
                tokenHash:
                  hashToken(token),
              },
            })

        expect(access).not.toBeNull()

        expect(access).toMatchObject({
          reportId,
          documentId,

          purpose:
            'INITIAL_CONFIRMATION',

          status:
            'ACTIVE',

          recipientEmail:
            contactEmail,

          createdByUserId:
            'cra-send-client-admin',

          emailMessageId:
            '<cra-client-test@example.invalid>',
        })

        expect(access!.emailSentAt)
          .not.toBeNull()

        expect(access!.revokedAt)
          .toBeNull()

        expect(
          access!.expiresAt.getTime(),
        ).toBeGreaterThanOrEqual(
          before
          + 6 * 24 * 60 * 60 * 1000,
        )

        expect(
          access!.expiresAt.getTime(),
        ).toBeLessThanOrEqual(
          before
          + 8 * 24 * 60 * 60 * 1000,
        )

        expect(
          JSON.stringify(result.data),
        ).not.toContain(token)

        expect(
          JSON.stringify(
            writeAuditLog
              .mock.calls[0]?.[2],
          ),
        ).not.toContain(token)

        expect(writeAuditLog)
          .toHaveBeenCalledWith(
            event,
            expect.any(Object),

            expect.objectContaining({
              action:
                'CRA_SIGNED_DOCUMENT_SENT_TO_CLIENT',

              entityType:
                'CraClientAccess',

              metadata:
                expect.objectContaining({
                  reportId,
                  documentId,
                  clientId,

                  contactId:
                    clientContactId,

                  recipient:
                    contactEmail,
                }),
            }),
          )
      },
    )

    it(
      'bloque un second envoi concurrent avant SMTP',
      async () => {
        const before = Date.now()

        let releaseMail:
          (() => void) | undefined

        const mailBlocked
          = new Promise<void>((resolve) => {
            releaseMail = resolve
          })

        mail.send.mockImplementationOnce(
          async () => {
            await mailBlocked

            return {
              delivered: true,

              messageId:
                '<cra-client-concurrent@example.invalid>',
            }
          },
        )

        const firstSend
          = handler(event)

        await vi.waitFor(() => {
          expect(mail.send)
            .toHaveBeenCalledTimes(1)
        })

        const pending
          = await prisma.craClientAccess
            .findMany({
              where: {
                reportId,
                documentId,

                purpose:
                  'INITIAL_CONFIRMATION',

                status:
                  'PENDING',
              },
            })

        expect(pending)
          .toHaveLength(1)

        expect(
          pending[0]!.expiresAt.getTime(),
        ).toBeGreaterThanOrEqual(
          before
          + 9 * 60 * 1000,
        )

        expect(
          pending[0]!.expiresAt.getTime(),
        ).toBeLessThanOrEqual(
          before
          + 11 * 60 * 1000,
        )

        await expect(
          handler(event),
        ).rejects.toMatchObject({
          statusCode: 409,

          data: {
            code:
              'CRA_SEND_CLIENT_IN_PROGRESS',
          },
        })

        expect(mail.send)
          .toHaveBeenCalledTimes(1)

        releaseMail!()

        const result
          = await firstSend

        expect(result.data.status)
          .toBe('ACTIVE')

        const active
          = await prisma.craClientAccess
            .findMany({
              where: {
                reportId,
                documentId,

                purpose:
                  'INITIAL_CONFIRMATION',

                status:
                  'ACTIVE',
              },
            })

        expect(active)
          .toHaveLength(1)

        expect(active[0]!.id)
          .toBe(result.data.accessId)
      },
    )

    it(
      'expire un verrou PENDING abandonné puis autorise un nouvel envoi',
      async () => {
        const abandoned
          = await prisma.craClientAccess.create({
            data: {
              reportId,
              documentId,

              purpose:
                'INITIAL_CONFIRMATION',

              status:
                'PENDING',

              tokenHash:
                hashToken(
                  `expired-${randomUUID()}`,
                ),

              recipientEmail:
                contactEmail,

              createdByUserId:
                'cra-send-client-admin',

              expiresAt:
                new Date(
                  Date.now() - 1000,
                ),
            },
          })

        const result
          = await handler(event)

        const expired
          = await prisma.craClientAccess
            .findUniqueOrThrow({
              where: {
                id: abandoned.id,
              },
            })

        expect(expired.status)
          .toBe('EXPIRED')

        expect(mail.send)
          .toHaveBeenCalledTimes(1)

        const active
          = await prisma.craClientAccess
            .findMany({
              where: {
                reportId,
                documentId,

                purpose:
                  'INITIAL_CONFIRMATION',

                status:
                  'ACTIVE',
              },
            })

        expect(active)
          .toHaveLength(1)

        expect(active[0]!.id)
          .toBe(result.data.accessId)
      },
    )

    it(
      'autorise aussi l’adresse générale du client rattaché',
      async () => {
        request.body = {
          ...request.body,
          to: clientEmail,
        }

        const result
          = await handler(event)

        expect(result.data.recipient)
          .toBe(clientEmail)

        expect(mail.send)
          .toHaveBeenCalledTimes(1)
      },
    )

    it(
      'refuse une adresse étrangère au projet',
      async () => {
        request.body = {
          ...request.body,

          to:
            'intrus@example.invalid',
        }

        await expect(
          handler(event),
        ).rejects.toMatchObject({
          statusCode: 400,

          data: {
            code:
              'CRA_CLIENT_RECIPIENT_NOT_ALLOWED',
          },
        })

        expect(mail.send)
          .not.toHaveBeenCalled()

        expect(
          await prisma.craClientAccess.count({
            where: {
              reportId,
            },
          }),
        ).toBe(0)
      },
    )

    it(
      'refuse sans CRA_SEND_CLIENT',
      async () => {
        request.permissions = [
          'cra:read:all',
        ]

        await expect(
          handler(event),
        ).rejects.toMatchObject({
          statusCode: 403,

          data: {
            code:
              'CRA_SEND_CLIENT_FORBIDDEN',
          },
        })

        expect(mail.send)
          .not.toHaveBeenCalled()
      },
    )

    it(
      'refuse un CRA signé non approuvé ou non CLEAN',
      async () => {
        await prisma.craDocument.update({
          where: {
            id: documentId,
          },

          data: {
            antivirusStatus:
              'PENDING',
          },
        })

        await expect(
          handler(event),
        ).rejects.toMatchObject({
          statusCode: 409,

          data: {
            code:
              'CRA_APPROVED_SIGNED_DOCUMENT_REQUIRED',
          },
        })

        expect(mail.send)
          .not.toHaveBeenCalled()
      },
    )

    it(
      'ne crée aucun accès si SMTP est désactivé',
      async () => {
        mail.enabled = false

        await expect(
          handler(event),
        ).rejects.toMatchObject({
          statusCode: 503,

          data: {
            code:
              'MAIL_DISABLED',
          },
        })

        expect(
          await prisma.craClientAccess.count({
            where: {
              reportId,
            },
          }),
        ).toBe(0)
      },
    )

    it(
      'conserve l’ancien accès si le serveur SMTP échoue',
      async () => {
        const previous
          = await createExistingAccess()

        mail.send.mockRejectedValueOnce(
          new Error('SMTP down'),
        )

        await expect(
          handler(event),
        ).rejects.toMatchObject({
          statusCode: 502,

          data: {
            code:
              'CRA_SEND_CLIENT_MAIL_FAILED',
          },
        })

        const current
          = await prisma.craClientAccess
            .findUniqueOrThrow({
              where: {
                id: previous.id,
              },
            })

        expect(current.status)
          .toBe('ACTIVE')

        expect(current.revokedAt)
          .toBeNull()

        expect(
          await prisma.craClientAccess.count({
            where: {
              reportId,
            },
          }),
        ).toBe(1)
      },
    )

    it(
      'révoque l’ancien lien seulement après le nouvel envoi réussi',
      async () => {
        const previous
          = await createExistingAccess()

        const result
          = await handler(event)

        expect(
          result.data
            .revokedPreviousCount,
        ).toBe(1)

        const oldAccess
          = await prisma.craClientAccess
            .findUniqueOrThrow({
              where: {
                id: previous.id,
              },
            })

        expect(oldAccess.status)
          .toBe('REVOKED')

        expect(oldAccess.revokedAt)
          .not.toBeNull()

        const active
          = await prisma.craClientAccess
            .findMany({
              where: {
                reportId,
                documentId,

                purpose:
                  'INITIAL_CONFIRMATION',

                status:
                  'ACTIVE',
              },
            })

        expect(active)
          .toHaveLength(1)

        expect(active[0]!.id)
          .toBe(result.data.accessId)
      },
    )

    it(
      'bloque un fichier physiquement altéré avant tout envoi',
      async () => {
        const document
          = await prisma.craDocument
            .findUniqueOrThrow({
              where: {
                id: documentId,
              },
            })

        await writeFile(
          resolveStoredPath(
            document.filePath,
          ),

          Buffer.from(
            'document-altere',
          ),
        )

        await expect(
          handler(event),
        ).rejects.toMatchObject({
          statusCode: 409,

          data: {
            code:
              'CRA_SIGNED_DOCUMENT_SIZE_MISMATCH',
          },
        })

        expect(mail.send)
          .not.toHaveBeenCalled()

        expect(
          await prisma.craClientAccess.count({
            where: {
              reportId,
            },
          }),
        ).toBe(0)
      },
    )
  },
)
