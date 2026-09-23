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
  prismaErrorCode,
  requireRouterId,
  success,
} from '../../../utils/api'
import { writeAuditLog } from '../../../utils/audit'
import { PERMISSIONS } from '../../../utils/constants'
import {
  getCraClientRecipients,
  normalizeCraClientEmail,
} from '../../../utils/cra-client-recipients'
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

const CLIENT_SEND_LOCK_TTL_MS
  = 10 * 60 * 1000

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
    'purpose',
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

  const purpose
    = body.purpose === undefined
      ? 'INITIAL_CONFIRMATION'
      : requiredString(
          body.purpose,
          'Type d’accès client',
          {
            min: 1,
            max: 40,
          },
        )

  if (
    purpose !== 'INITIAL_CONFIRMATION'
    && purpose !== 'REDOWNLOAD'
  ) {
    badRequest(
      'Le type d’accès client est invalide.',
    )
  }

  const recipient = requiredEmail(
    body.to,
    'Adresse email du destinataire',
  )

  const normalizedRecipient
    = normalizeCraClientEmail(recipient)

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

  let document = report.documents[0]

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

  const clientDecision
    = await prisma.craClientDecision.findFirst({
        where: {
          reportId:
            report.id,

          sourceDocumentId:
            document.id,
        },

        orderBy: {
          decidedAt:
            'desc',
        },

        select: {
          sourceDocumentSha256:
            true,

          attestedDocument: {
            select: {
              id: true,
              reportId: true,
              type: true,
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
              archivedAt: true,
            },
          },
        },
      })

  if (
    purpose === 'INITIAL_CONFIRMATION'
    && clientDecision
  ) {
    httpError(
      409,
      'Une décision client est déjà enregistrée pour ce CRA.',
      'CRA_CLIENT_DECISION_ALREADY_RECORDED',
    )
  }

  if (purpose === 'REDOWNLOAD') {
    if (!clientDecision) {
      httpError(
        409,
        'Aucune décision client ne permet de créer un lien de retéléchargement.',
        'CRA_CLIENT_REDOWNLOAD_DECISION_REQUIRED',
      )
    }

    if (
      clientDecision.sourceDocumentSha256
      !== document.sha256
    ) {
      httpError(
        409,
        'Le document source de la décision client ne correspond plus au CRA signé.',
        'CRA_CLIENT_REDOWNLOAD_SOURCE_MISMATCH',
      )
    }

    const attestedDocument
      = clientDecision.attestedDocument

    if (
      attestedDocument.type !== 'CLIENT_ATTESTED'
      || attestedDocument.status !== 'APPROVED'
      || attestedDocument.reportRevision
        !== report.revision
      || attestedDocument.mimeType
        !== 'application/pdf'
      || attestedDocument.antivirusStatus
        !== 'NOT_APPLICABLE'
      || attestedDocument.archivedAt
    ) {
      httpError(
        409,
        'L’attestation de décision client n’est pas disponible pour le retéléchargement.',
        'CRA_CLIENT_REDOWNLOAD_DOCUMENT_INVALID',
      )
    }

    if (!attestedDocument.sha256) {
      httpError(
        409,
        'L’empreinte de l’attestation client est absente.',
        'CRA_CLIENT_REDOWNLOAD_HASH_MISSING',
      )
    }

    document = attestedDocument
  }

  const allowedRecipients
    = await getCraClientRecipients(
      report.assignment.project.id,
      context.associationId,
    )

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

  const pendingExpiresAt = new Date(
    createdAt.getTime()
    + CLIENT_SEND_LOCK_TTL_MS,
  )

  /*
   * Un processus interrompu peut laisser un verrou
   * PENDING derrière lui. Avant de tenter un nouvel
   * envoi, seuls les verrous réellement expirés pour
   * ce document/purpose sont libérés.
   */
  await prisma.craClientAccess.updateMany({
    where: {
      reportId: report.id,
      documentId: document.id,

      purpose,

      status:
        'PENDING',

      expiresAt: {
        lte: createdAt,
      },
    },

    data: {
      status:
        'EXPIRED',
    },
  })

  let access: {
    id: string
  }

  try {
    access = await prisma.craClientAccess.create({
      data: {
        reportId: report.id,
        documentId: document.id,

        purpose,

        status:
          'PENDING',

        tokenHash,
        recipientEmail: recipient,

        createdByUserId:
          context.userId,

        expiresAt:
          pendingExpiresAt,
      },

      select: {
        id: true,
      },
    })
  }
  catch (cause) {
    /*
     * Seule une violation d'unicité peut correspondre
     * au verrou de concurrence. Toute autre erreur DB
     * doit remonter telle quelle.
     */
    if (prismaErrorCode(cause) !== 'P2002') {
      throw cause
    }

    /*
     * L'index unique partiel garantit qu'un second
     * envoi concurrent ne peut pas passer jusqu'à SMTP.
     *
     * On confirme qu'un verrou PENDING encore valide
     * existe réellement avant de convertir P2002 en
     * erreur métier.
     */
    const pending
      = await prisma.craClientAccess.findFirst({
        where: {
          reportId: report.id,
          documentId: document.id,

          purpose,

          status:
            'PENDING',

          expiresAt: {
            gt: createdAt,
          },
        },

        select: {
          id: true,
        },
      })

    if (pending) {
      httpError(
        409,
        'Un envoi de ce CRA au client est déjà en cours.',
        'CRA_SEND_CLIENT_IN_PROGRESS',
      )
    }

    throw cause
  }

  const baseUrl = (
    process.env.APP_BASE_URL
    || 'http://localhost:3000'
  ).replace(/\/$/, '')

  const clientUrl
    = `${baseUrl}/cra/client#token=${encodeURIComponent(token)}`

  const mailText = [
    message.trim(),
    '',
    purpose === 'REDOWNLOAD'
      ? 'Accès sécurisé au CRA et à son attestation :'
      : 'Accès sécurisé au CRA :',
    clientUrl,
    '',
    'Ce lien est personnel et valable pendant 7 jours.',
    purpose === 'REDOWNLOAD'
      ? 'Cet accès permet uniquement de consulter et télécharger le document déjà décidé. Aucune nouvelle décision n’est possible.'
      : 'Après votre décision, cet accès sera clôturé.',
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
          status: 'PENDING',
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
          status: 'PENDING',
        },
      })

    httpError(
      503,
      'Le lien sécurisé n’a pas été envoyé.',
      'CRA_SEND_CLIENT_NOT_DELIVERED',
    )
  }

  const sentAt = new Date()

  const activeExpiresAt = new Date(
    sentAt.getTime()
    + CLIENT_ACCESS_TTL_MS,
  )

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

                purpose,

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

        const activatedPending
          = await tx.craClientAccess
            .updateMany({
              where: {
                id: access.id,

                status:
                  'PENDING',
              },

              data: {
                status:
                  'ACTIVE',

                expiresAt:
                  activeExpiresAt,

                emailSentAt:
                  sentAt,

                emailMessageId:
                  delivery.messageId,
              },
            })

        if (activatedPending.count !== 1) {
          throw new Error(
            'CRA_CLIENT_PENDING_ACCESS_NOT_ACTIVATABLE',
          )
        }

        const current
          = await tx.craClientAccess
            .findUniqueOrThrow({
              where: {
                id: access.id,
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
        purpose === 'REDOWNLOAD'
          ? 'CRA_CLIENT_REDOWNLOAD_SENT'
          : 'CRA_SIGNED_DOCUMENT_SENT_TO_CLIENT',

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
