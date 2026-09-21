import { createHash } from 'node:crypto'
import { readBody } from 'h3'
import {
  httpError,
  success,
} from '../../utils/api'
import { writeAuditLogStrict } from '../../utils/audit'
import {
  clearCraClientCookie,
  requireActiveCraClientAccess,
  setCraClientNoStoreHeaders,
} from '../../utils/cra-client-access'
import {
  generateCraClientAttestationPdf,
  type CraClientDecisionValue,
} from '../../utils/cra-client-attestation'
import {
  getCraClientRecipients,
  normalizeCraClientEmail,
} from '../../utils/cra-client-recipients'
import {
  readStoredFile,
  removeStoredFile,
  storePdf,
} from '../../utils/files'
import { prisma } from '../../utils/prisma'
import {
  badRequest,
  optionalString,
  requiredEnum,
  requiredString,
  safeObject,
} from '../../utils/validation'

const DECISIONS = [
  'ACCEPTED',
  'REFUSED',
] as const

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
])

function shortReportReference(
  reportId: string,
): string {
  const compact = reportId
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()

  return compact
    .slice(-8)
    .padStart(8, '0')
}

export default defineEventHandler(async (event) => {
  setCraClientNoStoreHeaders(event)

  const access
    = await requireActiveCraClientAccess(
      event,
    )

  if (
    access.purpose
    !== 'INITIAL_CONFIRMATION'
  ) {
    httpError(
      403,
      'Cet accès ne permet pas de prendre une décision sur le CRA.',
      'CRA_CLIENT_DECISION_FORBIDDEN',
    )
  }

  const body = safeObject(
    await readBody(event),
  )

  const allowedFields = new Set([
    'decision',
    'firstName',
    'lastName',
    'jobTitle',
    'comment',
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

  const decision
    = requiredEnum(
      body.decision,
      DECISIONS,
      'Décision',
    ) as CraClientDecisionValue

  const firstName = requiredString(
    body.firstName,
    'Prénom',
    {
      max: 120,
    },
  )

  const lastName = requiredString(
    body.lastName,
    'Nom',
    {
      max: 120,
    },
  )

  const jobTitle = requiredString(
    body.jobTitle,
    'Fonction',
    {
      max: 180,
    },
  )

  const comment = optionalString(
    body.comment,
    'Commentaire',
    {
      max: 2000,
    },
  )

  if (
    decision === 'REFUSED'
    && !comment
  ) {
    badRequest(
      'Le commentaire est obligatoire en cas de refus.',
      'CRA_CLIENT_REFUSAL_COMMENT_REQUIRED',
    )
  }

  const document = access.document
  const report = document.report

  if (
    !ALLOWED_MIME_TYPES.has(
      document.mimeType,
    )
  ) {
    httpError(
      409,
      'Le format du CRA signé n’est pas autorisé.',
      'CRA_CLIENT_DOCUMENT_INVALID_TYPE',
    )
  }

  if (!document.sha256) {
    httpError(
      409,
      'L’intégrité du CRA signé ne peut pas être confirmée.',
      'CRA_CLIENT_DOCUMENT_HASH_MISSING',
    )
  }

  const sourceDocumentSha256
    = document.sha256

  const sourceBuffer
    = await readStoredFile(
      document.filePath,
    )

  if (
    BigInt(sourceBuffer.length)
    !== document.fileSize
  ) {
    httpError(
      409,
      'L’intégrité du CRA signé ne peut pas être confirmée.',
      'CRA_CLIENT_DOCUMENT_SIZE_MISMATCH',
    )
  }

  const actualSha256
    = createHash('sha256')
      .update(sourceBuffer)
      .digest('hex')

  if (
    actualSha256
    !== sourceDocumentSha256
  ) {
    httpError(
      409,
      'L’intégrité du CRA signé ne peut pas être confirmée.',
      'CRA_CLIENT_DOCUMENT_HASH_MISMATCH',
    )
  }

  const recipients
    = await getCraClientRecipients(
      report.assignment.project.id,
      report.associationId,
    )

  const recipient
    = recipients.get(
      normalizeCraClientEmail(
        access.recipientEmail,
      ),
    )

  if (!recipient) {
    httpError(
      409,
      'Le rattachement du destinataire au client n’est plus disponible.',
      'CRA_CLIENT_RECIPIENT_CONTEXT_UNAVAILABLE',
    )
  }

  const previousAttestedDocument
    = await prisma.craDocument.findFirst({
      where: {
        reportId:
          access.reportId,

        type:
          'CLIENT_ATTESTED',
      },

      orderBy: {
        version:
          'desc',
      },

      select: {
        version:
          true,
      },
    })

  const version
    = (
      previousAttestedDocument?.version
      ?? 0
    ) + 1

  const decisionReferencePart
    = decision === 'ACCEPTED'
      ? 'ACCEPTED'
      : 'REFUSED'

  const reference = [
    'CRA',
    report.year,
    String(report.month)
      .padStart(2, '0'),
    shortReportReference(
      access.reportId,
    ),
    'CLIENT',
    decisionReferencePart,
    `V${version}`,
  ].join('-')

  const decidedAt = new Date()

  const pdfBytes
    = await generateCraClientAttestationPdf({
      sourceBytes:
        sourceBuffer,

      sourceMimeType:
        document.mimeType as
          | 'application/pdf'
          | 'image/png'
          | 'image/jpeg',

      attestedReference:
        reference,

      decision,

      firstName,
      lastName,
      jobTitle,

      organizationName:
        recipient.clientName,

      recipientEmail:
        access.recipientEmail,

      comment,

      decidedAt,

      sourceDocumentReference:
        document.reference,

      sourceDocumentSha256,
    })

  const stored
    = await storePdf(
      'cra',
      access.reportId,
      `${reference}.pdf`,
      Buffer.from(pdfBytes),
    )

  let result

  try {
    result = await prisma.$transaction(
      async (tx) => {
        /*
         * Cette mise à jour joue aussi le rôle
         * de verrou métier contre deux décisions
         * concurrentes sur le même accès.
         */
        const completed
          = await tx.craClientAccess
            .updateMany({
              where: {
                id:
                  access.id,

                reportId:
                  access.reportId,

                purpose:
                  'INITIAL_CONFIRMATION',

                status:
                  'ACTIVE',

                completedAt:
                  null,

                revokedAt:
                  null,

                expiresAt: {
                  gt:
                    decidedAt,
                },
              },

              data: {
                status:
                  'COMPLETED',

                confirmedAt:
                  decision === 'ACCEPTED'
                    ? decidedAt
                    : null,

                completedAt:
                  decidedAt,
              },
            })

        if (completed.count !== 1) {
          httpError(
            409,
            'La décision sur ce CRA a déjà été traitée ou cet accès n’est plus valide.',
            'CRA_CLIENT_DECISION_CONFLICT',
          )
        }

        /*
         * On revérifie la révision au sein
         * de la transaction avant de créer
         * le document final.
         */
        const currentReport
          = await tx.craReport.findFirst({
            where: {
              id:
                access.reportId,

              status:
                'REVIEWED',

              revision:
                document.reportRevision,
            },

            select: {
              id:
                true,
            },
          })

        if (!currentReport) {
          httpError(
            409,
            'Le CRA a changé avant l’enregistrement de la décision.',
            'CRA_CLIENT_DECISION_STALE_REPORT',
          )
        }

        const attestedDocument
          = await tx.craDocument.create({
            data: {
              reportId:
                access.reportId,

              type:
                'CLIENT_ATTESTED',

              status:
                'APPROVED',

              version,

              reportRevision:
                document.reportRevision,

              reference,

              originalName:
                `${reference}.pdf`,

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

              sourceDocumentId:
                document.id,

              reviewedAt:
                decidedAt,

              antivirusStatus:
                'NOT_APPLICABLE',

              antivirusCheckedAt:
                decidedAt,

              antivirusResult:
                'Document généré en interne par IFICS à partir du CRA signé et approuvé.',
            },

            select: {
              id:
                true,

              reference:
                true,

              sha256:
                true,
            },
          })

        const clientDecision
          = await tx.craClientDecision.create({
            data: {
              accessId:
                access.id,

              reportId:
                access.reportId,

              decision,

              firstName,
              lastName,
              jobTitle,
              comment,

              recipientEmail:
                access.recipientEmail,

              organizationName:
                recipient.clientName,

              decidedAt,

              sourceDocumentId:
                document.id,

              sourceDocumentReference:
                document.reference,

              sourceDocumentSha256,

              attestedDocumentId:
                attestedDocument.id,
            },

            select: {
              id:
                true,

              decision:
                true,

              firstName:
                true,

              lastName:
                true,

              jobTitle:
                true,

              comment:
                true,

              organizationName:
                true,

              recipientEmail:
                true,

              decidedAt:
                true,

              sourceDocumentReference:
                true,

              attestedDocumentId:
                true,
            },
          })

        await writeAuditLogStrict(
          event,
          null,
          {
            associationId:
              report.associationId,

            userId:
              null,

            action:
              'CRA_CLIENT_DECISION_RECORDED',

            entityType:
              'CraClientDecision',

            entityId:
              clientDecision.id,

            metadata: {
              reportId:
                access.reportId,

              accessId:
                access.id,

              sourceDocumentId:
                document.id,

              sourceDocumentReference:
                document.reference,

              sourceDocumentSha256,

              attestedDocumentId:
                attestedDocument.id,

              attestedDocumentReference:
                attestedDocument.reference,

              decision,

              decidedAt:
                decidedAt.toISOString(),

              recipientEmail:
                access.recipientEmail,

              organizationName:
                recipient.clientName,
            },
          },
          tx,
        )

        return {
          decision:
            clientDecision,

          document: {
            id:
              attestedDocument.id,

            reference:
              attestedDocument.reference,

            sha256:
              attestedDocument.sha256,
          },

          completedAt:
            decidedAt,
        }
      },
    )
  }
  catch (error) {
    /*
     * Le fichier est créé avant la transaction.
     * Si la transaction échoue, on le supprime
     * pour éviter tout fichier orphelin.
     */
    try {
      await removeStoredFile(
        stored.filePath,
      )
    }
    catch (cleanupError) {
      console.error(
        'CRA_CLIENT_ATTESTATION_FILE_CLEANUP_FAILED',
        {
          reportId:
            access.reportId,

          filePath:
            stored.filePath,

          cleanupError,
        },
      )
    }

    throw error
  }

  /*
   * Le cookie n’est supprimé qu’après
   * document + décision + audit validés.
   */
  clearCraClientCookie(event)

  return success(result)
})
