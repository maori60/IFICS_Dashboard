import { getRouterParam, readBody } from 'h3'
import { requirePermission } from '../../../utils/auth'
import { PERMISSIONS } from '../../../utils/constants'
import { prisma } from '../../../utils/prisma'
import { httpError, requireRouterId, success } from '../../../utils/api'
import { optionalString, requiredEnum, safeObject } from '../../../utils/validation'
import { writeAuditLog } from '../../../utils/audit'
import { notifyUser } from '../../../utils/notifications'

const STATUSES = ['VALIDATED', 'REFUSED'] as const

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.REPORT_REVIEW)
  const id = requireRouterId(getRouterParam(event, 'id'), 'Bilan')
  const body = safeObject(await readBody(event))
  const status = requiredEnum(body.status, STATUSES, 'Décision')
  const refusalReason = status === 'REFUSED' ? optionalString(body.refusalReason, 'Motif du refus') : null
  if (status === 'REFUSED' && !refusalReason) httpError(400, 'Le motif du refus est obligatoire.', 'REFUSAL_REASON_REQUIRED')
  const report = await prisma.projectReport.findFirst({ where: { id, status: 'SUBMITTED', project: { associationId: context.associationId } }, select: { id: true, intervenor: { select: { userId: true } } } })
  if (!report) httpError(404, 'Bilan soumis introuvable.', 'REPORT_NOT_FOUND')
  const now = new Date()
  const updated = await prisma.projectReport.update({ where: { id }, data: { status, refusalReason, reviewedByUserId: context.userId, reviewedAt: now, validatedAt: status === 'VALIDATED' ? now : null }, select: { id: true, status: true, refusalReason: true, reviewedAt: true, validatedAt: true } })
  if (report.intervenor?.userId) {
    await notifyUser(report.intervenor.userId, {
      type: status === 'VALIDATED' ? 'SUCCESS' : 'WARNING',
      title: 'Bilan examiné',
      message: status === 'VALIDATED' ? 'Votre bilan a été validé.' : `Votre bilan a été refusé : ${refusalReason}`,
      href: `/reports/${id}`,
    })
  }
  await writeAuditLog(event, context, { action: 'REPORT_REVIEWED', entityType: 'ProjectReport', entityId: id, metadata: { status } })
  return success(updated)
})
