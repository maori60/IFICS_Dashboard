import { requirePermission } from '../../../utils/auth'
import { PERMISSIONS } from '../../../utils/constants'
import { prisma } from '../../../utils/prisma'
import { success } from '../../../utils/api'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.SECURITY_MFA_RESET)
  if (!context.mfaVerified) throw createError({ statusCode: 403, statusMessage: 'Validation MFA administrateur requise.' })

  const requests = await prisma.mfaResetRequest.findMany({
    where: { associationId: context.associationId }, orderBy: { requestedAt: 'desc' }, take: 100,
  })
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(requests.map(request => request.userId))] } },
    select: { id: true, firstName: true, lastName: true, email: true, role: { select: { code: true, name: true } } },
  })
  const byId = new Map(users.map(user => [user.id, user]))
  return success(requests.map(request => ({ ...request, tokenHash: undefined, user: byId.get(request.userId) || null })))
})
