import { requirePermission } from '../../utils/auth'
import { PERMISSIONS, ROLE_CODES } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { success } from '../../utils/api'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.REPORT_READ)
  const reports = await prisma.projectReport.findMany({
    where: {
      project: { associationId: context.associationId, archivedAt: null },
      ...(context.roleCode === ROLE_CODES.CLIENT && context.clientId ? { project: { associationId: context.associationId, archivedAt: null, projectClients: { some: { clientId: context.clientId } } } } : {}),
      ...(context.roleCode === ROLE_CODES.INTERVENOR && context.intervenorId ? { intervenorId: context.intervenorId } : {}),
    },
    orderBy: { sessionDate: 'desc' },
    select: { id: true, title: true, sessionDate: true, studentsCount: true, status: true, currentVersion: true, submittedAt: true, validatedAt: true, project: { select: { id: true, title: true, reference: true } }, intervenor: { select: { id: true, firstName: true, lastName: true } } },
  })
  return success(reports)
})
