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
  badRequest,
  requiredEmail,
  requiredString,
  safeObject,
} from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  const context = await requireAuth(event)

  if (
    !hasPermission(context, PERMISSIONS.CRA_READ_ALL)
    || !hasPermission(context, PERMISSIONS.CRA_MANAGE)
  ) {
    httpError(
      403,
      'Envoi du CRA à l’intervenant interdit.',
      'CRA_SEND_INTERVENOR_FORBIDDEN',
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
      'CRA_SEND_INTERVENOR_CONFIRMATION_REQUIRED',
    )
  }

  const recipient = requiredEmail(
    body.to,
    'Adresse email du destinataire',
  )

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
              email: true,
            },
          },
        },
      },

      documents: {
        where: {
          type: 'IFICS_TO_SIGN',
          archivedAt: null,

          status: {
            in: [
              'GENERATED',
              'SENT_TO_INTERVENOR',
            ],
          },
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
          sentToIntervenorAt: true,
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
      'Le CRA doit être vérifié par IFICS avant son envoi à l’intervenant.',
      'CRA_SEND_INTERVENOR_INVALID_STATUS',
    )
  }

  const document = report.documents[0]

  if (!document) {
    httpError(
      409,
      'Aucun document officiel actif n’est disponible. Générez d’abord le CRA officiel.',
      'CRA_OFFICIAL_DOCUMENT_REQUIRED',
    )
  }

  if (document.reportRevision !== report.revision) {
    httpError(
      409,
      'Le document officiel ne correspond plus à la révision actuelle du CRA.',
      'CRA_OFFICIAL_DOCUMENT_STALE',
    )
  }

  if (document.mimeType !== 'application/pdf') {
    httpError(
      409,
      'Le document officiel n’est pas un PDF valide.',
      'CRA_DOCUMENT_INVALID_MIME',
    )
  }

  if (!document.sha256) {
    httpError(
      409,
      'L’empreinte du document officiel est absente.',
      'CRA_DOCUMENT_HASH_MISSING',
    )
  }

  const pdf = await readStoredFile(
    document.filePath,
  )

  if (
    BigInt(pdf.length)
    !== document.fileSize
  ) {
    httpError(
      409,
      'La taille du document officiel ne correspond plus au fichier enregistré.',
      'CRA_DOCUMENT_SIZE_MISMATCH',
    )
  }

  const actualSha256 = createHash('sha256')
    .update(pdf)
    .digest('hex')

  if (actualSha256 !== document.sha256) {
    httpError(
      409,
      'L’intégrité du document officiel ne peut pas être confirmée.',
      'CRA_DOCUMENT_HASH_MISMATCH',
    )
  }

  if (!isMailEnabled()) {
    httpError(
      503,
      'Le service email IFICS n’est pas configuré.',
      'MAIL_DISABLED',
    )
  }

  let delivery:
    Awaited<ReturnType<typeof sendMailDetailed>>

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
      text: message,

      attachments: [
        {
          filename: document.originalName,
          content: pdf,
          contentType: 'application/pdf',
        },
      ],
    })
  }
  catch {
    httpError(
      502,
      'Le serveur email n’a pas pu envoyer le CRA.',
      'CRA_SEND_INTERVENOR_MAIL_FAILED',
    )
  }

  if (!delivery.delivered) {
    httpError(
      503,
      'Le CRA n’a pas été envoyé.',
      'CRA_SEND_INTERVENOR_NOT_DELIVERED',
    )
  }

  const sentAt = new Date()
  const wasResend
    = document.status === 'SENT_TO_INTERVENOR'

  const updated = await prisma.craDocument.updateMany({
    where: {
      id: document.id,
      reportId: report.id,
      archivedAt: null,

      status: {
        in: [
          'GENERATED',
          'SENT_TO_INTERVENOR',
        ],
      },
    },

    data: {
      status: 'SENT_TO_INTERVENOR',
      sentToIntervenorAt: sentAt,
    },
  })

  if (updated.count !== 1) {
    httpError(
      409,
      'Le document a changé pendant l’envoi. Vérifiez son état avant de recommencer.',
      'CRA_SEND_INTERVENOR_CONFLICT',
    )
  }

  await writeAuditLog(event, context, {
    action: wasResend
      ? 'CRA_OFFICIAL_DOCUMENT_RESENT_TO_INTERVENOR'
      : 'CRA_OFFICIAL_DOCUMENT_SENT_TO_INTERVENOR',

    entityType: 'CraDocument',
    entityId: document.id,

    metadata: {
      reportId: report.id,
      documentReference: document.reference,
      documentVersion: document.version,
      reportRevision: document.reportRevision,
      recipient,
      subject,
      sha256: document.sha256,
      messageId: delivery.messageId,
      resend: wasResend,
    },
  })

  return success({
    documentId: document.id,
    reference: document.reference,
    version: document.version,
    status: 'SENT_TO_INTERVENOR' as const,
    recipient,
    sentToIntervenorAt: sentAt,
  })
})
