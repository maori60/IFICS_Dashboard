import {
  getRouterParam,
  readBody,
} from 'h3'
import {
  hasPermission,
  requirePermission,
} from '../../../../../utils/auth'
import {
  httpError,
  requireRouterId,
  success,
} from '../../../../../utils/api'
import { writeAuditLog } from '../../../../../utils/audit'
import { PERMISSIONS } from '../../../../../utils/constants'
import { notifyUser } from '../../../../../utils/notifications'
import { prisma } from '../../../../../utils/prisma'
import {
  requiredEnum,
  safeObject,
} from '../../../../../utils/validation'

const DECISIONS = [
  'APPROVED',
  'REJECTED',
] as const

export default defineEventHandler(async (event) => {
  const context = await requirePermission(
    event,
    PERMISSIONS.CRA_REVIEW,
  )

  const reportId = requireRouterId(
    getRouterParam(event, 'id'),
    'CRA',
  )

  const documentId = requireRouterId(
    getRouterParam(event, 'documentId'),
    'document CRA',
  )

  const body = safeObject(
    await readBody(event),
  )

  const decision = requiredEnum(
    body.decision,
    DECISIONS,
    'Décision',
  )

  let rejectionReason: string | null = null

  if (decision === 'REJECTED') {
    if (typeof body.rejectionReason !== 'string') {
      httpError(
        400,
        'Le motif du rejet est obligatoire.',
        'CRA_SIGNED_REJECTION_REASON_REQUIRED',
      )
    }

    rejectionReason = body.rejectionReason.trim()

    if (!rejectionReason) {
      httpError(
        400,
        'Le motif du rejet est obligatoire.',
        'CRA_SIGNED_REJECTION_REASON_REQUIRED',
      )
    }

    if (rejectionReason.length > 2000) {
      httpError(
        400,
        'Le motif du rejet ne peut pas dépasser 2 000 caractères.',
        'CRA_SIGNED_REJECTION_REASON_TOO_LONG',
      )
    }
  }

  const canReadConfidential = hasPermission(
    context,
    PERMISSIONS.PROJECT_CONFIDENTIAL_READ,
  )

  const document = await prisma.craDocument.findFirst({
    where: {
      id: documentId,
      reportId,
      type: 'INTERVENOR_SIGNED',
      archivedAt: null,

      report: {
        associationId: context.associationId,
        status: 'REVIEWED',

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
    },

    select: {
      id: true,
      status: true,
      antivirusStatus: true,
      reference: true,
      sourceDocumentId: true,

      report: {
        select: {
          assignment: {
            select: {
              intervenor: {
                select: {
                  userId: true,
                },
              },
            },
          },
        },
      },
    },
  })

  if (!document) {
    httpError(
      404,
      'CRA signé introuvable ou inaccessible.',
      'CRA_SIGNED_DOCUMENT_NOT_FOUND',
    )
  }

  if (document.antivirusStatus !== 'CLEAN') {
    httpError(
      409,
      'Le CRA signé n’a pas passé le contrôle antivirus.',
      'CRA_SIGNED_DOCUMENT_NOT_CLEAN',
    )
  }

  if (document.status !== 'RECEIVED') {
    httpError(
      409,
      'Ce CRA signé a déjà été examiné.',
      'CRA_SIGNED_DOCUMENT_ALREADY_REVIEWED',
    )
  }

  const now = new Date()

  const updated = await prisma.craDocument.updateMany({
    where: {
      id: document.id,
      status: 'RECEIVED',
      antivirusStatus: 'CLEAN',
      archivedAt: null,
    },

    data: {
      status: decision,
      reviewedByUserId: context.userId,
      reviewedAt: now,
      rejectionReason:
        decision === 'REJECTED'
          ? rejectionReason
          : null,
    },
  })

  if (updated.count !== 1) {
    httpError(
      409,
      'Ce CRA signé vient déjà d’être examiné.',
      'CRA_SIGNED_DOCUMENT_REVIEW_CONFLICT',
    )
  }

  const reviewedDocument
    = await prisma.craDocument.findUnique({
      where: {
        id: document.id,
      },

      select: {
        id: true,
        type: true,
        status: true,
        version: true,
        reference: true,
        reportRevision: true,
        sourceDocumentId: true,
        reviewedAt: true,
        reviewedByUserId: true,
        rejectionReason: true,
      },
    })

  if (!reviewedDocument) {
    httpError(
      500,
      'Le CRA signé validé est introuvable.',
      'CRA_SIGNED_DOCUMENT_REVIEW_RESULT_MISSING',
    )
  }

  if (document.report.assignment.intervenor.userId) {
    await notifyUser(
      document.report.assignment.intervenor.userId,
      {
        type:
          decision === 'APPROVED'
            ? 'SUCCESS'
            : 'WARNING',

        title:
          decision === 'APPROVED'
            ? 'CRA signé validé'
            : 'CRA signé à redéposer',

        message:
          decision === 'APPROVED'
            ? `Votre CRA signé ${document.reference} a été validé par IFICS.`
            : `Votre CRA signé ${document.reference} a été rejeté par IFICS. Un nouveau dépôt est nécessaire.`,

        href: `/dashboard/cra/${reportId}`,
      },
    )
  }

  await writeAuditLog(
    event,
    context,
    {
      action:
        decision === 'APPROVED'
          ? 'CRA_SIGNED_DOCUMENT_APPROVED'
          : 'CRA_SIGNED_DOCUMENT_REJECTED',

      outcome: 'SUCCESS',
      entityType: 'CraDocument',
      entityId: document.id,

      metadata: {
        reportId,
        reference: document.reference,
        sourceDocumentId:
          document.sourceDocumentId,
        decision,
        rejectionReason,
      },
    },
  )

  return success(reviewedDocument)
})
