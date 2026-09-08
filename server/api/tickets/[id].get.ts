import { getRouterParam } from 'h3'
import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { assertTicketOwner, canManageTickets } from '../../utils/tickets'
import { httpError, requireRouterId, success } from '../../utils/api'

const DEFAULT_PROGRESS: Record<string, number> = {
  NEW: 10,
  IN_PROGRESS: 45,
  WAITING_REQUESTER: 60,
  RESOLVED: 100,
  CLOSED: 100,
}

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.TICKET_READ)
  const id = requireRouterId(getRouterParam(event, 'id'), 'Ticket')
  const ticket = await prisma.supportTicket.findFirst({
    where: { id, associationId: context.associationId },
    include: { comments: { orderBy: { createdAt: 'asc' } } },
  })
  if (!ticket) httpError(404, 'Ticket introuvable.', 'TICKET_NOT_FOUND')
  assertTicketOwner(context, ticket.requesterUserId)

  const internal = canManageTickets(context)
  const visibleComments = internal ? ticket.comments : ticket.comments.filter(comment => !comment.internal)
  const authorIds = [...new Set(visibleComments.map(comment => comment.authorUserId).filter((value): value is string => Boolean(value)))]

  const [progress, authors] = await Promise.all([
    prisma.ticketProgress.findUnique({ where: { ticketId: id } }),
    authorIds.length
      ? prisma.user.findMany({
          where: { id: { in: authorIds }, associationId: context.associationId },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : Promise.resolve([]),
  ])

  const authorById = new Map(authors.map(author => [author.id, author]))

  return success({
    ...ticket,
    comments: visibleComments.map(comment => ({
      ...comment,
      author: comment.authorUserId ? authorById.get(comment.authorUserId) ?? null : null,
    })),
    progress: progress ?? {
      progressPercent: DEFAULT_PROGRESS[ticket.status] ?? 0,
      nextAction: null,
      resolutionSummary: null,
      updatedByUserId: null,
      updatedAt: ticket.updatedAt,
    },
  })
})