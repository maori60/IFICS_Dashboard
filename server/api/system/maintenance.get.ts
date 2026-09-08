import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { success } from '../../utils/api'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.SETTINGS_MANAGE)
  const association = await prisma.association.findUnique({
    where: { id: context.associationId },
    select: { maintenanceEnabled: true, maintenanceMessage: true, maintenanceStartsAt: true, maintenanceEndsAt: true },
  })
  return success(association)
})
