import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { success } from '../../utils/api'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.PROJECT_READ)

  const projects = await prisma.project.findMany({
    where: {
      associationId: context.associationId,
      archivedAt: null,
      ...(context.roleCode === 'CLIENT'
        ? { projectClients: { some: { clientId: context.clientId || '__no_client__' } } }
        : {}),
      ...(context.roleCode === 'INTERVENOR'
        ? { projectIntervenors: { some: { intervenorId: context.intervenorId || '__no_intervenor__' } } }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, reference: true, title: true, status: true },
  })

  return success(projects)
})
