import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { httpError, success } from '../../utils/api'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.SETTINGS_MANAGE)
  const association = await prisma.association.findUnique({ where: { id: context.associationId } })
  if (!association) httpError(404, 'Association introuvable.', 'ASSOCIATION_NOT_FOUND')
  return success(association)
})
