import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { success } from '../../utils/api'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.PROJECT_ASSIGN)

  const intervenors = await prisma.intervenor.findMany({
    where: { associationId: context.associationId, archivedAt: null, status: 'ACTIVE' },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    select: { id: true, firstName: true, lastName: true, email: true, specialty: true },
  })

  return success(intervenors)
})
