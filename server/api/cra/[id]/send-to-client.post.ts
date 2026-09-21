import { createHash } from 'node:crypto'
import {
  getRouterParam,
  readBody,
} from 'h3'
import {
  hasPermission,
  requireAuth,
} from '../../../utils/auth'
import {
  httpError,
  requireRouterId,
  success,
} from '../../../utils/api'
import { writeAuditLog } from '../../../utils/audit'
import { PERMISSIONS } from '../../../utils/constants'
import { readStoredFile } from '../../../utils/files'
import {
  isMailEnabled,
  sendMailDetailed,
} from '../../../utils/mail'
import { prisma } from '../../../utils/prisma'
import {
  createOpaqueToken,
  hashToken,
} from '../../../utils/security'
import {
  badRequest,
  requiredEmail,
  requiredString,
  safeObject,
} from '../../../utils/validation'

const CLIENT_ACCESS_TTL_MS
  = 7 * 24 * 60 * 60 * 1000

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export default defineEventHandler(async (event) => {
  const context = await requireAuth(event)

  if (
    !hasPermission(context, PERMISSIONS.CRA_READ_ALL)
    || !hasPermission(
      context,
      PERMISSIONS.CRA_SEND_CLIENT,
    )
  ) {
    httpError(
      403,
      'Envoi du CRA au client interdit.',
      'CRA_SEND_CLIENT_FORBIDDEN',
    )
  }

  const reportId = requireRouterId(
    getRouterParam(event, 'id'),
    'CRA',
  )

  const body = safeObject(await readBody(event))

  const allowedFields = new Set([
    'to',
    'subject',
    'message',
    'confirmed',
  ])

  if (
    Object.keys(body).some(
      key => !allowedFields.has(key),
    )
  ) {
    badRequest(
      'La demande contient un champ non autorisé.',
    )
  }

  if (body.confirmed !== true) {
    httpError(
      400,
      'La confirmation de l’envoi est obligatoire.',
      'CRA_SEND_CLIENT_CONFIRMATION_REQUIRED',
    )
  }

  const recipient = requiredEmail(
    body.to,
    'Adresse email du destinataire',
  )

  const normalizedRecipient
    = normalizeEmail(recipient)

  const subject = requiredString(
    body.subject,
    'Objet du message',
    {
      min: 1,
      max: 200,
    },
  )

  const message = requiredString(
    body.message,
    'Message',
    {
      min: 1,
      max: 12_000,
    },
  )

  const canReadConfidential = hasPermission(
    context,
    PERMISSIONS.PROJECT_CONFIDENTIAL_READ,
  )

  const report = await prisma.craReport.findFirst({
    where: {
      id: reportId,
      associationId: context.associationId,

      assignment: {
        project: {
          associationId: context.associationId,

          ...(!canReadConfidential
            ? {
                classification: {
                  notIn: [
                    'CONFIDENTIAL',
                    'RESTRICTED',
                  ],
                },
              }
            : {}),
        },
      },
    },

    select: {
      id: true,
      revision: true,
      year: true,
      month: true,
      status: true,

      assignment: {
        select: {
          project: {
            select: {
              id: true,
              reference: true,
              title: true,
            },
          },

          intervenor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },

      documents: {
        where: {
          type: 'INTERVENOR_SIGNED',
          status: 'APPROVED',
          antivirusStatus: 'CLEAN',
          archivedAt: null,
        },

        orderBy: {
          version: 'desc',
        },

        take: 1,

        select: {
          id: true,
          reportId: true,
          status: true,
          version: true,
          reportRevision: true,
          reference: true,
          originalName: true,
          filePath: true,
          mimeType: true,
          fileSize: true,
          sha256: true,
          antivirusStatus: true,
        },
      },
    },
  })

  if (!report) {
    httpError(
      404,
      'CRA introuvable ou inaccessible.',
      'CRA_NOT_FOUND',
    )
  }

  if (report.status !== 'REVIEWED') {
    httpError(
      409,
      'Le CRA doit être vérifié par IFICS avant son envoi au client.',
      'CRA_SEND_CLIENT_INVALID_STATUS',
    )
  }

  const document = report.documents[0]

  if (!document) {
    httpError(
      409,
      'Aucun CRA signé et approuvé n’est disponible pour le client.',
      'CRA_APPROVED_SIGNED_DOCUMENT_REQUIRED',
    )
  }

  if (
    document.reportRevision
    !== report.revision
  ) {
    httpError(
      409,
      'Le CRA signé ne correspond plus à la révision actuelle du CRA.',
      'CRA_SIGNED_DOCUMENT_STALE',
    )
  }

  if (
    ![
      'application/pdf',
      'image/png',
      'image/jpeg',
    ].includes(document.mimeType)
  ) {
    httpError(
      409,
      'Le format du CRA signé n’est pas autorisé.',
      'CRA_SIGNED_DOCUMENT_INVALID_MIME',
    )
  }

  if (!document.sha256) {
    httpError(
      409,
      'L’empreinte du CRA signé est absente.',
      'CRA_SIGNED_DOCUMENT_HASH_MISSING',
    )
  }

  const projectClients
    = await prisma.projectClient.findMany({
      where: {
        projectId:
          report.assignment.project.id,

        client: {
          associationId:
            context.associationId,

          status: 'ACTIVE',
          archivedAt: null,
        },
      },

      select: {
        clientId: true,

        client: {
          select: {
            id: true,
            name: true,
            email: true,

            contacts: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                isPrimary: true,
              },
            },
          },
        },
      },
    })

  const allowedRecipients = new Map<
    string,
    {
      clientId: string
      clientName: string
      contactId: string | null
    }
  >()

  for (const projectClient of projectClients) {
    const client = projectClient.client

    if (client.email) {
      allowedRecipients.set(
        normalizeEmail(client.email),
        {
          clientId: client.id,
          clientName: client.name,
          contactId: null,
        },
      )
    }

    for (const contact of client.contacts) {
      if (!contact.email) continue

      allowedRecipients.set(
        normalizeEmail(contact.email),
        {
          clientId: client.id,
          clientName: client.name,
          contactId: contact.id,
        },
      )
    }
  }

  const recipientTarget
    = allowedRecipients.get(
      normalizedRecipient,
    )

  if (!recipientTarget) {
    httpError(
      400,
      'Le destinataire doit appartenir à un client rattaché à ce projet.',
      'CRA_CLIENT_RECIPIENT_NOT_ALLOWED',
    )
  }

  const stored
    = await readStoredFile(
      document.filePath,
    )

  if (
    BigInt(stored.length)
    !== document.fileSize
  ) {
    httpError(
      409,
      'La taille du CRA signé ne correspond plus au fichier enregistré.',
      'CRA_SIGNED_DOCUMENT_SIZE_MISMATCH',
    )
  }

  const actualSha256 = createHash('sha256')
    .update(stored)
    .digest('hex')

  if (actualSha256 !== document.sha256) {
    httpError(
      409,
      'L’intégrité du CRA signé ne peut pas être confirmée.',
      'CRA_SIGNED_DOCUMENT_HASH_MISMATCH',
    )
  }

  if (!isMailEnabled()) {
    httpError(
      503,
      'Le service email IFICS n’est pas configuré.',
      'MAIL_DISABLED',
    )
  }

  const token = createOpaqueToken(32)
  const tokenHash = hashToken(token)

  const createdAt = new Date()

  const expiresAt = new Date(
    createdAt.getTime()
    + CLIENT_ACCESS_TTL_MS,
  )

  /*
   * L’accès est créé dans un état non utilisable avant
   * l’envoi du mail. Ainsi, si SMTP échoue, aucun nouveau
   * lien actif n’est laissé en base et l’ancien lien reste
   * utilisable.
   */
  const access
    = await prisma.craClientAccess.create({
      data: {
        reportId: report.id,
        documentId: document.id,

        purpose:
          'INITIAL_CONFIRMATION',

        status: 'REVOKED',
        revokedAt: createdAt,

        tokenHash,
        recipientEmail: recipient,

        createdByUserId:
          context.userId,

        expiresAt,
      },

      select: {
        id: true,
      },
    })

  const baseUrl = (
    process.env.APP_BASE_URL
    || 'http://localhost:3000'
  ).replace(/\/$/, '')

  const clientUrl
    = `${baseUrl}/cra/client#token=${encodeURIComponent(token)}`

  const mailText = [
    message.trim(),
    '',
    'Accès sécurisé au CRA :',
    clientUrl,
    '',
    'Ce lien est personnel et valable pendant 7 jours.',
    'Après confirmation du CRA, cet accès pourra être clôturé.',
  ].join('\n')

  let delivery:
    Awaited<
      ReturnType<typeof sendMailDetailed>
    >

  try {
    delivery = await sendMailDetailed({
      from:
        process.env.CRA_MAIL_FROM
        || 'IFICS - CRA <cra@ifics.org>',

      replyTo:
        process.env.CRA_MAIL_REPLY_TO
        || 'cra@ifics.org',

      to: recipient,
      subject,
      text: mailText,
    })
  }
  catch {
    await prisma.craClientAccess
      .deleteMany({
        where: {
          id: access.id,
          status: 'REVOKED',
        },
      })

    httpError(
      502,
      'Le serveur email n’a pas pu envoyer le lien sécurisé.',
      'CRA_SEND_CLIENT_MAIL_FAILED',
    )
  }

  if (!delivery.delivered) {
    await prisma.craClientAccess
      .deleteMany({
        where: {
          id: access.id,
          status: 'REVOKED',
        },
      })

    httpError(
      503,
      'Le lien sécurisé n’a pas été envoyé.',
      'CRA_SEND_CLIENT_NOT_DELIVERED',
    )
  }

  const sentAt = new Date()

  const activated
    = await prisma.$transaction(
      async (tx) => {
        const revoked
          = await tx.craClientAccess
            .updateMany({
              where: {
                reportId:
                  report.id,

                documentId:
                  document.id,

                purpose:
                  'INITIAL_CONFIRMATION',

                status:
                  'ACTIVE',

                id: {
                  not: access.id,
                },
              },

              data: {
                status:
                  'REVOKED',

                revokedAt:
                  sentAt,
              },
            })

        const current
          = await tx.craClientAccess
            .update({
              where: {
                id: access.id,
              },

              data: {
                status:
                  'ACTIVE',

                revokedAt:
                  null,

                emailSentAt:
                  sentAt,

                emailMessageId:
                  delivery.messageId,
              },

              select: {
                id: true,
                reportId: true,
                documentId: true,
                purpose: true,
                status: true,
                recipientEmail: true,
                expiresAt: true,
                emailSentAt: true,
                emailMessageId: true,
              },
            })

        return {
          current,
          revokedPreviousCount:
            revoked.count,
        }
      },
    )

  await writeAuditLog(
    event,
    context,
    {
      action:
        'CRA_SIGNED_DOCUMENT_SENT_TO_CLIENT',

      entityType:
        'CraClientAccess',

      entityId:
        activated.current.id,

      metadata: {
        reportId:
          report.id,

        documentId:
          document.id,

        documentReference:
          document.reference,

        documentVersion:
          document.version,

        projectId:
          report.assignment.project.id,

        projectReference:
          report.assignment.project.reference,

        clientId:
          recipientTarget.clientId,

        clientName:
          recipientTarget.clientName,

        contactId:
          recipientTarget.contactId,

        recipient,

        purpose:
          activated.current.purpose,

        expiresAt:
          activated.current.expiresAt,

        emailMessageId:
          activated.current.emailMessageId,

        revokedPreviousCount:
          activated.revokedPreviousCount,
      },
    },
  )

  return success({
    accessId:
      activated.current.id,

    documentId:
      document.id,

    reference:
      document.reference,

    version:
      document.version,

    recipient:
      activated.current.recipientEmail,

    purpose:
      activated.current.purpose,

    status:
      activated.current.status,

    expiresAt:
      activated.current.expiresAt,

    emailSentAt:
      activated.current.emailSentAt,

    revokedPreviousCount:
      activated.revokedPreviousCount,
  })
})
