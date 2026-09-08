import { getRouterParam, readBody } from 'h3'
import { requirePermission } from '../../../utils/auth'
import { PERMISSIONS } from '../../../utils/constants'
import { prisma } from '../../../utils/prisma'
import { httpError, requireRouterId, success } from '../../../utils/api'
import { optionalEnum, optionalInteger, optionalString, safeObject } from '../../../utils/validation'
import { writeAuditLog } from '../../../utils/audit'
import { notifyUser } from '../../../utils/notifications'

const STATUSES = ['NEW', 'IN_PROGRESS', 'WAITING_REQUESTER', 'RESOLVED', 'CLOSED'] as const
const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.TICKET_MANAGE)
  const id = requireRouterId(getRouterParam(event, 'id'), 'Ticket')
  const body = safeObject(await readBody(event))
  const existing = await prisma.supportTicket.findFirst({
    where: { id, associationId: context.associationId },
    select: { id: true, number: true, requesterUserId: true, status: true, resolvedAt: true, closedAt: true },
  })
  if (!existing) httpError(404, 'Ticket introuvable.', 'TICKET_NOT_FOUND')

  const status = optionalEnum(body.status, STATUSES, 'Statut')
  const priority = optionalEnum(body.priority, PRIORITIES, 'Priorité')
  const assigneeUserId = body.assigneeUserId === null ? null : optionalString(body.assigneeUserId, 'Assigné', { max: 191 })
  const progressPercent = optionalInteger(body.progressPercent, 'Progression', { min: 0, max: 100 })
  const nextAction = optionalString(body.nextAction, 'Prochaine action', { max: 5000 })
  const resolutionSummary = optionalString(body.resolutionSummary, 'Résumé de résolution', { max: 10_000 })

  if (assigneeUserId) {
    const assignee = await prisma.user.findFirst({
      where: { id: assigneeUserId, associationId: context.associationId, status: 'ACTIVE' },
      select: { id: true },
    })
    if (!assignee) httpError(400, 'Utilisateur assigné invalide.', 'INVALID_ASSIGNEE')
  }

  const now = new Date()
  const effectiveStatus = status ?? existing.status
  const terminal = effectiveStatus === 'RESOLVED' || effectiveStatus === 'CLOSED'
  const effectiveProgress = terminal ? 100 : progressPercent

  const updated = await prisma.$transaction(async (tx) => {
    const ticket = await tx.supportTicket.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(priority ? { priority } : {}),
        ...(body.assigneeUserId !== undefined ? { assigneeUserId } : {}),
        ...(status === 'RESOLVED' ? { resolvedAt: existing.resolvedAt ?? now, closedAt: null } : {}),
        ...(status === 'CLOSED' ? { resolvedAt: existing.resolvedAt ?? now, closedAt: existing.closedAt ?? now } : {}),
        ...(status && status !== 'RESOLVED' && status !== 'CLOSED' ? { resolvedAt: null, closedAt: null } : {}),
      },
    })

    if (
      effectiveProgress !== null
      || body.nextAction !== undefined
      || body.resolutionSummary !== undefined
      || terminal
    ) {
      await tx.ticketProgress.upsert({
        where: { ticketId: id },
        create: {
          ticketId: id,
          progressPercent: effectiveProgress ?? 0,
          nextAction,
          resolutionSummary,
          updatedByUserId: context.userId,
        },
        update: {
          ...(effectiveProgress !== null ? { progressPercent: effectiveProgress } : {}),
          ...(body.nextAction !== undefined ? { nextAction } : {}),
          ...(body.resolutionSummary !== undefined ? { resolutionSummary } : {}),
          updatedByUserId: context.userId,
        },
      })
    }

    return ticket
  })

  if (existing.requesterUserId && status && status !== existing.status) {
    await notifyUser(existing.requesterUserId, {
      type: status === 'RESOLVED' || status === 'CLOSED' ? 'SUCCESS' : 'INFO',
      title: `Ticket ${existing.number}`,
      message: `Le statut est maintenant ${status}.`,
      href: `/tickets/${id}`,
    })
  }

  await writeAuditLog(event, context, {
    action: 'TICKET_MANAGED',
    entityType: 'SupportTicket',
    entityId: id,
    metadata: {
      status,
      priority,
      assigneeUserId,
      progressPercent: effectiveProgress,
      hasNextAction: Boolean(nextAction),
      hasResolutionSummary: Boolean(resolutionSummary),
    },
  })

  return success(updated)
})