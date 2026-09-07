import { hasPermission, requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { jsonSafe, success } from '../../utils/api'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.PROJECT_READ)
  const mayReadClassified = hasPermission(context, PERMISSIONS.PROJECT_CONFIDENTIAL_READ)

  const projects = await prisma.project.findMany({
    where: {
      associationId: context.associationId,
      archivedAt: null,
      ...(!mayReadClassified ? { classification: { in: ['PUBLIC', 'INTERNAL'] as const } } : {}),
      ...(context.roleCode === 'CLIENT'
        ? { projectClients: { some: { clientId: context.clientId || '__no_client__' } } }
        : {}),
      ...(context.roleCode === 'INTERVENOR'
        ? { projectIntervenors: { some: { intervenorId: context.intervenorId || '__no_intervenor__' } } }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, reference: true, title: true, description: true, status: true, classification: true,
      startDate: true, endDate: true, plannedBudget: true, actualBudget: true, createdAt: true, updatedAt: true,
      projectClients: { orderBy: { isMainClient: 'desc' }, select: { id: true, isMainClient: true, client: { select: { id: true, name: true, type: true } } } },
      projectIntervenors: { select: { id: true, assignmentStatus: true, intervenor: { select: { id: true, firstName: true, lastName: true, specialty: true } } } },
      _count: { select: { documents: true, reports: true, billingDocuments: true } },
    },
  })
  return success(jsonSafe(projects))
})
