import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { success } from '../../utils/api'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.HR_WRITE)
  const [users, profiles] = await Promise.all([
    prisma.user.findMany({
      where: { associationId: context.associationId, status: 'ACTIVE' },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
    prisma.hrProfile.findMany({ where: { associationId: context.associationId }, select: { userId: true, id: true } }),
  ])
  const profileByUser = new Map(profiles.map(profile => [profile.userId, profile.id]))
  return success(users.map(user => ({ ...user, profileId: profileByUser.get(user.id) || null })))
})
