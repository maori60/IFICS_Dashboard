import { getRouterParam, readBody } from 'h3'
import { assertProjectAccess, requirePermission } from '../../../utils/auth'
import { PERMISSIONS } from '../../../utils/constants'
import { prisma } from '../../../utils/prisma'
import { httpError, requireRouterId, success } from '../../../utils/api'
import { optionalString, requiredEnum, safeObject } from '../../../utils/validation'
import { writeAuditLog } from '../../../utils/audit'
import { officialReportArchiveEnabled } from '../../../utils/report-archive-activation'
import { validateAndArchiveOfficialReport } from '../../../utils/report-archive-service'
import { notifyUser } from '../../../utils/notifications'

const STATUSES = ['VALIDATED', 'REFUSED'] as const

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.REPORT_REVIEW)
  const id = requireRouterId(getRouterParam(event, 'id'), 'Bilan')
  const body = safeObject(await readBody(event))
  const status = requiredEnum(body.status, STATUSES, 'Décision')
  const refusalReason = status === 'REFUSED' ? optionalString(body.refusalReason, 'Motif du refus') : null
  if (status === 'REFUSED' && !refusalReason) httpError(400, 'Le motif du refus est obligatoire.', 'REFUSAL_REASON_REQUIRED')
  const report = await prisma.projectReport.findFirst({ where: { id, status: 'SUBMITTED', project: { associationId: context.associationId, archivedAt: null } }, select: { id: true, projectId: true, currentVersion: true, intervenor: { select: { userId: true } } } })
  if (!report) httpError(404, 'Bilan soumis introuvable.', 'REPORT_NOT_FOUND')
  await assertProjectAccess(context, report.projectId, false)
  if (report.currentVersion < 1) {
    httpError(409, 'Le bilan ne contient aucune version à valider.', 'REPORT_EMPTY')
  }
  if (status === 'VALIDATED') {
    if (!officialReportArchiveEnabled()) {
      httpError(
        503,
        'La validation officielle est temporairement indisponible.',
        'REPORT_OFFICIAL_ARCHIVE_DISABLED',
      )
    }

    await validateAndArchiveOfficialReport({
      event,
      context,
      reportId: id,
    })
  }
  else {
    const now = new Date()

    const transition = await prisma.projectReport.updateMany({
      where: {
        id,
        status: 'SUBMITTED',
        currentVersion: report.currentVersion,
        project: {
          associationId: context.associationId,
          archivedAt: null,
        },
      },
      data: {
        status: 'REFUSED',
        refusalReason,
        revisionByIfics: false,
        reviewedByUserId: context.userId,
        reviewedAt: now,
        validatedAt: null,
      },
    })

    if (transition.count !== 1) {
      httpError(
        409,
        'Ce bilan vient déjà de faire l’objet d’une décision. Actualisez la page.',
        'REPORT_CONFLICT',
      )
    }
  }

  const updated = await prisma.projectReport.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      status: true,
      refusalReason: true,
      reviewedAt: true,
      validatedAt: true,
    },
  })
  if (report.intervenor?.userId) {
    await notifyUser(report.intervenor.userId, {
      type: status === 'VALIDATED' ? 'SUCCESS' : 'WARNING',
      title: 'Bilan examiné',
      message: status === 'VALIDATED' ? 'Votre bilan a été validé.' : `Votre bilan a été refusé : ${refusalReason}`,
      href: `/reports/${id}`,
    })
  }
  if (status === 'REFUSED') {
    await writeAuditLog(event, context, {
      action: 'REPORT_REVIEWED',
      entityType: 'ProjectReport',
      entityId: id,
      metadata: { status },
    })
  }
  return success(updated)
})
