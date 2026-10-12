import { getRouterParam } from 'h3'
import { assertProjectAccess, hasPermission, requirePermission } from '../../../utils/auth'
import { PERMISSIONS, ROLE_CODES } from '../../../utils/constants'
import { prisma } from '../../../utils/prisma'
import { httpError, requireRouterId, success } from '../../../utils/api'
import { writeAuditLog } from '../../../utils/audit'
import { notifyRoles } from '../../../utils/notifications'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.REPORT_WRITE)
  const id = requireRouterId(getRouterParam(event, 'id'), 'Bilan')
  const report = await prisma.projectReport.findFirst({
    where: { id, project: { associationId: context.associationId, archivedAt: null } },
    select: { id: true, projectId: true, intervenorId: true, currentVersion: true, status: true, revisionByIfics: true, project: { select: { title: true } } },
  })
  if (!report) httpError(404, 'Bilan introuvable.', 'REPORT_NOT_FOUND')
  await assertProjectAccess(context, report.projectId, false)
  if (context.roleCode === ROLE_CODES.INTERVENOR && report.intervenorId !== context.intervenorId) httpError(403, 'Soumission interdite.', 'REPORT_FORBIDDEN')
  if (report.revisionByIfics && (
    context.roleCode === ROLE_CODES.INTERVENOR
    || context.roleCode === ROLE_CODES.CLIENT
    || !hasPermission(context, PERMISSIONS.REPORT_REVIEW)
  )) {
    httpError(403, 'Soumission réservée à IFICS.', 'REPORT_IFICS_REVISION_LOCKED')
  }
  if (report.currentVersion < 1) httpError(409, 'Enregistrez au moins une version avant soumission.', 'REPORT_EMPTY')
  if (report.status !== 'IN_PROGRESS') {
    httpError(409, 'Ce bilan ne peut pas être transmis dans son état actuel.', 'REPORT_INVALID_STATUS')
  }

  const submittedAt = new Date()
  const transition = await prisma.projectReport.updateMany({
    where: {
      id,
      status: 'IN_PROGRESS',
      currentVersion: report.currentVersion,
      revisionByIfics: report.revisionByIfics,
    },
    data: {
      status: 'SUBMITTED',
      submittedAt,
      refusalReason: null,
    },
  })

  if (transition.count !== 1) {
    httpError(409, 'Le bilan a changé entre-temps. Actualisez la page.', 'REPORT_CONFLICT')
  }

  const updated = await prisma.projectReport.findUniqueOrThrow({
    where: { id },
    select: { id: true, status: true, submittedAt: true },
  })
  await notifyRoles(context.associationId, ['ADMIN', 'MANAGER'], {
    type: 'ACTION', title: 'Bilan à valider', message: `Un bilan du projet « ${report.project.title} » attend une validation.`, href: `/reports/${id}`,
  })
  await writeAuditLog(event, context, { action: 'REPORT_SUBMITTED', entityType: 'ProjectReport', entityId: id })
  return success(updated)
})
