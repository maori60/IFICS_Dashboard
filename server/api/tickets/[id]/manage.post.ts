import { getRouterParam, readBody } from 'h3'
import { requirePermission } from '../../../utils/auth'
import { PERMISSIONS } from '../../../utils/constants'
import { prisma } from '../../../utils/prisma'
import { httpError, requireRouterId, success } from '../../../utils/api'
import { optionalEnum, optionalString, safeObject } from '../../../utils/validation'
import { writeAuditLog } from '../../../utils/audit'
import { notifyUser } from '../../../utils/notifications'

const STATUSES = ['NEW', 'IN_PROGRESS', 'WAITING_REQUESTER', 'RESOLVED', 'CLOSED'] as const
const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.TICKET_MANAGE)
  const id = requireRouterId(getRouterParam(event, 'id'), 'Ticket')
  const body = safeObject(await readBody(event))
  const existing = await prisma.supportTicket.findFirst({ where: { id, associationId: context.associationId }, select: { id: true, number: true, requesterUserId: true, status: true } })
  if (!existing) httpError(404, 'Ticket introuvable.', 'TICKET_NOT_FOUND')
  const status = optionalEnum(body.status, STATUSES, 'Statut')
  const priority = optionalEnum(body.priority, PRIORITIES, 'Priorité')
  const assigneeUserId = body.assigneeUserId === null ? null : optionalString(body.assigneeUserId, 'Assigné', { max: 191 })
  if (assigneeUserId) {
    const assignee = await prisma.user.findFirst({ where: { id: assigneeUserId, associationId: context.associationId, status: 'ACTIVE' }, select: { id: true } })
    if (!assignee) httpError(400, 'Utilisateur assigné invalide.', 'INVALID_ASSIGNEE')
  }
  const now = new Date()
  const updated = await prisma.supportTicket.update({
    where: { id },
    data: {
      ...(status ? { status } : {}), ...(priority ? { priority } : {}),
      ...(body.assigneeUserId !== undefined ? { assigneeUserId } : {}),
      ...(status === 'RESOLVED' ? { resolvedAt: now } : {}),
      ...(status === 'CLOSED' ? { closedAt: now } : {}),
    },
  })
  if (existing.requesterUserId && status && status !== existing.status) await notifyUser(existing.requesterUserId, { type: status === 'RESOLVED' || status === 'CLOSED' ? 'SUCCESS' : 'INFO', title: `Ticket ${existing.number}`, message: `Le statut est maintenant ${status}.`, href: `/tickets/${id}` })
  await writeAuditLog(event, context, { action: 'TICKET_MANAGED', entityType: 'SupportTicket', entityId: id, metadata: { status, priority, assigneeUserId } })
  return success(updated)
})
