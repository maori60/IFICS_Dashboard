import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { success } from '../../utils/api'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.USER_MANAGE)

  const users = await prisma.user.findMany({
    where: { associationId: context.associationId },
    orderBy: [{ status: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      status: true,
      accessExpiresAt: true,
      lastLoginAt: true,
      mfaEnabled: true,
      createdAt: true,
      updatedAt: true,
      role: {
        select: { id: true, code: true, name: true },
      },
      client: {
        select: { id: true, name: true },
      },
      intervenorProfile: {
        select: { id: true, firstName: true, lastName: true },
      },
      _count: {
        select: { sessions: true },
      },
    },
  })

  return success(users)
})
