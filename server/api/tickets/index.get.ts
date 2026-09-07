import { getQuery } from 'h3'
import { hasPermission, requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { success } from '../../utils/api'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.TICKET_READ)
  const query = getQuery(event)
  const internal = hasPermission(context, PERMISSIONS.TICKET_MANAGE)
  const status = typeof query.status === 'string' ? query.status : undefined
  const tickets = await prisma.supportTicket.findMany({
    where: {
      associationId: context.associationId,
      ...(internal ? {} : { requesterUserId: context.userId }),
      ...(status && ['NEW', 'IN_PROGRESS', 'WAITING_REQUESTER', 'RESOLVED', 'CLOSED'].includes(status) ? { status: status as 'NEW' | 'IN_PROGRESS' | 'WAITING_REQUESTER' | 'RESOLVED' | 'CLOSED' } : {}),
    },
    orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
    select: { id: true, number: true, projectId: true, category: true, priority: true, status: true, subject: true, requesterUserId: true, assigneeUserId: true, resolvedAt: true, closedAt: true, createdAt: true, updatedAt: true, _count: { select: { comments: true } } },
  })
  return success(tickets)
})
