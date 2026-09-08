import { getRouterParam } from 'h3'
import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { httpError, requireRouterId, success } from '../../utils/api'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.HR_READ)
  const id = requireRouterId(getRouterParam(event, 'id'), 'Profil RH')
  const profile = await prisma.hrProfile.findFirst({
    where: { id, associationId: context.associationId },
    include: {
      absences: { orderBy: { startDate: 'desc' } },
      trainings: { orderBy: { createdAt: 'desc' } },
      reviews: { orderBy: { reviewDate: 'desc' } },
    },
  })
  if (!profile) httpError(404, 'Profil RH introuvable.', 'HR_PROFILE_NOT_FOUND')

  const users = await prisma.user.findMany({
    where: { associationId: context.associationId, id: { in: [profile.userId, profile.managerUserId].filter((value): value is string => Boolean(value)) } },
    select: { id: true, firstName: true, lastName: true, email: true, status: true },
  })
  const byId = new Map(users.map(user => [user.id, user]))

  return success({
    ...profile,
    user: byId.get(profile.userId) || null,
    manager: profile.managerUserId ? byId.get(profile.managerUserId) || null : null,
  })
})
