import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { success } from '../../utils/api'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.HR_READ)
  const profiles = await prisma.hrProfile.findMany({
    where: { associationId: context.associationId },
    orderBy: { createdAt: 'desc' },
    include: {
      absences: { orderBy: { startDate: 'desc' } },
      trainings: { orderBy: { createdAt: 'desc' } },
      reviews: { orderBy: { reviewDate: 'desc' } },
    },
  })

  const userIds = [...new Set(profiles.flatMap(profile => [profile.userId, profile.managerUserId].filter((value): value is string => Boolean(value))))]
  const users = await prisma.user.findMany({
    where: { associationId: context.associationId, id: { in: userIds } },
    select: { id: true, firstName: true, lastName: true, email: true, status: true },
  })
  const byId = new Map(users.map(user => [user.id, user]))

  return success(profiles.map(profile => ({
    ...profile,
    user: byId.get(profile.userId) || null,
    manager: profile.managerUserId ? byId.get(profile.managerUserId) || null : null,
  })))
})
