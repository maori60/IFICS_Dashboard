import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { success } from '../../utils/api'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.PARTNER_READ)
  const partners = await prisma.partner.findMany({
    where: { associationId: context.associationId },
    orderBy: [{ stage: 'asc' }, { name: 'asc' }],
    include: { contacts: { orderBy: [{ isPrimary: 'desc' }, { lastName: 'asc' }] }, interactions: { orderBy: { occurredAt: 'desc' }, take: 10 }, _count: { select: { messages: true } } },
  })
  return success(partners)
})
