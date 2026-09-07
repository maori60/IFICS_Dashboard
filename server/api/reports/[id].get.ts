import { getRouterParam } from 'h3'
import { assertProjectAccess, requirePermission } from '../../utils/auth'
import { PERMISSIONS, ROLE_CODES } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { httpError, requireRouterId, success } from '../../utils/api'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.REPORT_READ)
  const id = requireRouterId(getRouterParam(event, 'id'), 'Bilan')
  const report = await prisma.projectReport.findFirst({
    where: { id, project: { associationId: context.associationId, archivedAt: null } },
    select: { id: true, projectId: true, intervenorId: true, title: true, sessionDate: true, studentsCount: true, status: true, currentVersion: true, comment: true, refusalReason: true, submittedAt: true, validatedAt: true, reviewedAt: true, createdAt: true, updatedAt: true, project: { select: { id: true, title: true, reference: true } }, intervenor: { select: { id: true, firstName: true, lastName: true } }, versions: { orderBy: { version: 'desc' }, select: { id: true, version: true, content: true, createdAt: true, createdByUserId: true } } },
  })
  if (!report) httpError(404, 'Bilan introuvable.', 'REPORT_NOT_FOUND')
  await assertProjectAccess(context, report.projectId, false)
  if (context.roleCode === ROLE_CODES.INTERVENOR && report.intervenorId !== context.intervenorId) httpError(403, 'Bilan interdit.', 'REPORT_FORBIDDEN')
  return success(report)
})
