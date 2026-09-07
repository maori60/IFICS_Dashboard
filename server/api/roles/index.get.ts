import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { success } from '../../utils/api'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.USER_MANAGE)
  const roles = await prisma.role.findMany({ where: { associationId: context.associationId }, orderBy: [{ isSystemRole: 'desc' }, { name: 'asc' }], select: { id: true, name: true, code: true, description: true, permissions: true, isSystemRole: true, _count: { select: { users: true } } } })
  return success(roles)
})
