import { getRouterParam, readBody } from 'h3'
import { requirePermission } from '../../../utils/auth'
import { PERMISSIONS } from '../../../utils/constants'
import { prisma } from '../../../utils/prisma'
import { assertTicketOwner, canManageTickets } from '../../../utils/tickets'
import { httpError, requireRouterId, success } from '../../../utils/api'
import { requiredString, safeObject } from '../../../utils/validation'
import { writeAuditLog } from '../../../utils/audit'
import { notifyUser } from '../../../utils/notifications'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.TICKET_WRITE)
  const id = requireRouterId(getRouterParam(event, 'id'), 'Ticket')
  const body = safeObject(await readBody(event))
  const ticket = await prisma.supportTicket.findFirst({ where: { id, associationId: context.associationId }, select: { id: true, number: true, requesterUserId: true, assigneeUserId: true } })
  if (!ticket) httpError(404, 'Ticket introuvable.', 'TICKET_NOT_FOUND')
  assertTicketOwner(context, ticket.requesterUserId)
  const internal = canManageTickets(context) && body.internal === true
  const comment = await prisma.ticketComment.create({ data: { ticketId: id, authorUserId: context.userId, body: requiredString(body.body, 'Commentaire', { min: 1, max: 20000 }), internal } })
  const recipient = canManageTickets(context) ? ticket.requesterUserId : ticket.assigneeUserId
  if (recipient && recipient !== context.userId && !internal) await notifyUser(recipient, { type: 'INFO', title: `Mise à jour ${ticket.number}`, message: 'Un nouveau commentaire a été ajouté.', href: `/tickets/${id}` })
  await writeAuditLog(event, context, { action: 'TICKET_COMMENT_ADDED', entityType: 'SupportTicket', entityId: id, metadata: { commentId: comment.id, internal } })
  return success(comment)
})
