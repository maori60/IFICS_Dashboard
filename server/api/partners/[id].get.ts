import { getRouterParam } from 'h3'
import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { httpError, requireRouterId, success } from '../../utils/api'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.PARTNER_READ)
  const id = requireRouterId(getRouterParam(event, 'id'), 'Partenaire')

  const partner = await prisma.partner.findFirst({
    where: { id, associationId: context.associationId },
    include: {
      contacts: { orderBy: [{ isPrimary: 'desc' }, { lastName: 'asc' }] },
      interactions: { orderBy: { occurredAt: 'desc' }, take: 100 },
      _count: { select: { messages: true } },
    },
  })

  if (!partner) httpError(404, 'Partenaire introuvable.', 'PARTNER_NOT_FOUND')
  return success(partner)
})
