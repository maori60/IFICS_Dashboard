import { getRouterParam } from 'h3'
import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { assertTicketOwner, canManageTickets } from '../../utils/tickets'
import { httpError, requireRouterId, success } from '../../utils/api'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.TICKET_READ)
  const id = requireRouterId(getRouterParam(event, 'id'), 'Ticket')
  const ticket = await prisma.supportTicket.findFirst({
    where: { id, associationId: context.associationId },
    include: { comments: { orderBy: { createdAt: 'asc' } } },
  })
  if (!ticket) httpError(404, 'Ticket introuvable.', 'TICKET_NOT_FOUND')
  assertTicketOwner(context, ticket.requesterUserId)
  if (!canManageTickets(context)) ticket.comments = ticket.comments.filter(comment => !comment.internal)
  return success(ticket)
})
