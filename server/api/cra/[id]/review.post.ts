import { getRouterParam, readBody } from 'h3'
import type { Prisma } from '../../../../generated/prisma/client'
import { hasPermission, requireAuth } from '../../../utils/auth'
import {
  httpError,
  requireRouterId,
  success,
} from '../../../utils/api'
import { writeAuditLog } from '../../../utils/audit'
import { PERMISSIONS } from '../../../utils/constants'
import { prisma } from '../../../utils/prisma'
import {
  badRequest,
  optionalString,
  requiredEnum,
  safeObject,
} from '../../../utils/validation'

const DECISIONS = ['REVIEWED', 'REFUSED'] as const

export default defineEventHandler(async (event) => {
  const context = await requireAuth(event)

  if (
    !hasPermission(context, PERMISSIONS.CRA_READ_ALL)
    || !hasPermission(context, PERMISSIONS.CRA_REVIEW)
  ) {
    httpError(
      403,
      'Vous ne disposez pas des droits de vérification des CRA.',
      'CRA_FORBIDDEN',
    )
  }

  const reportId = requireRouterId(getRouterParam(event, 'id'), 'CRA')
  const body = safeObject(await readBody(event))

  const allowedFields = new Set([
    'decision',
    'correctionReason',
    'confirmed',
    'revision',
  ])

  if (Object.keys(body).some(key => !allowedFields.has(key))) {
    badRequest('La demande contient un champ non autorisé.')
  }

  if (body.confirmed !== true) {
    badRequest('Vous devez confirmer votre décision.')
  }

  const decision = requiredEnum(body.decision, DECISIONS, 'Décision')

  const correctionReason = optionalString(
    body.correctionReason,
    'Motif de correction',
    { max: 2000 },
  )?.trim() || null

  if (decision === 'REFUSED' && !correctionReason) {
    badRequest('Indiquez les corrections attendues de l’intervenant.')
  }

  if (decision === 'REVIEWED' && correctionReason) {
    badRequest(
      'Un motif de correction ne peut pas accompagner une vérification favorable.',
    )
  }

  const revision = body.revision

  if (
    typeof revision !== 'number'
    || !Number.isSafeInteger(revision)
    || revision < 1
    || revision >= 2147483647
  ) {
    badRequest('Révision du CRA invalide.')
  }

  const canReadConfidential = hasPermission(
    context,
    PERMISSIONS.PROJECT_CONFIDENTIAL_READ,
  )

  const reportScope: Prisma.CraReportWhereInput = {
    id: reportId,
    associationId: context.associationId,
    assignment: {
      project: {
        associationId: context.associationId,
        ...(!canReadConfidential
          ? { classification: { notIn: ['CONFIDENTIAL', 'RESTRICTED'] } }
          : {}),
      },
      intervenor: {
        associationId: context.associationId,
      },
    },
  }

  const result = await prisma.$transaction(async (tx) => {
    const report = await tx.craReport.findFirst({
      where: reportScope,
      select: {
        id: true,
        year: true,
        month: true,
        assignment: {
          select: {
            project: {
              select: { title: true },
            },
            intervenor: {
              select: { userId: true },
            },
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

    const decidedAt = new Date()

    const updated = await tx.craReport.updateMany({
      where: {
        ...reportScope,
        status: 'SUBMITTED',
        revision,
      },
      data: {
        status: decision,
        revision: { increment: 1 },
        reviewedAt: decision === 'REVIEWED' ? decidedAt : null,
        reviewedById: decision === 'REVIEWED' ? context.userId : null,
        correctionRequestedAt: decision === 'REFUSED' ? decidedAt : null,
        correctionRequestedById: decision === 'REFUSED'
          ? context.userId
          : null,
        correctionReason,
      },
    })

    if (updated.count !== 1) {
      httpError(
        409,
        'Ce CRA a été modifié ou ne peut plus être vérifié. Rechargez-le avant de continuer.',
        'CRA_REVIEW_CONFLICT',
      )
    }

    const intervenorUserId = report.assignment.intervenor.userId

    if (intervenorUserId) {
      const recipient = await tx.user.findFirst({
        where: {
          id: intervenorUserId,
          associationId: context.associationId,
          status: 'ACTIVE',
        },
        select: { id: true },
      })

      if (recipient) {
        const period = `${String(report.month).padStart(2, '0')}/${report.year}`
        const projectTitle = report.assignment.project.title

        await tx.notification.create({
          data: {
            userId: recipient.id,
            type: decision === 'REVIEWED' ? 'SUCCESS' : 'ACTION',
            title: decision === 'REVIEWED'
              ? 'CRA vérifié par IFICS'
              : 'Correction demandée sur votre CRA',
            message: decision === 'REVIEWED'
              ? `Votre CRA de ${period} pour le projet « ${projectTitle} » a été vérifié par IFICS. La prochaine étape est la génération du document officiel à vous faire signer.`
              : `IFICS demande une correction de votre CRA de ${period} pour le projet « ${projectTitle} » : ${correctionReason}`,
            href: `/dashboard/cra/${report.id}`,
          },
        })
      }
    }

    return {
      reportId: report.id,
      status: decision,
      revision: revision + 1,
      reviewedAt: decision === 'REVIEWED' ? decidedAt : null,
      reviewedById: decision === 'REVIEWED' ? context.userId : null,
      correctionRequestedAt: decision === 'REFUSED' ? decidedAt : null,
      correctionRequestedById: decision === 'REFUSED'
        ? context.userId
        : null,
      correctionReason,
    }
  })

  await writeAuditLog(event, context, {
    action: decision === 'REVIEWED'
      ? 'CRA_REVIEWED'
      : 'CRA_CORRECTION_REQUESTED',
    entityType: 'CraReport',
    entityId: result.reportId,
    metadata: {
      previousStatus: 'SUBMITTED',
      status: result.status,
      previousRevision: revision,
      revision: result.revision,
      correctionReason,
    },
  })

  return success(result)
})