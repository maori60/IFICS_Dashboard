import { readBody } from 'h3'
import { assertProjectAccess, requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { nextTicketNumber } from '../../utils/tickets'
import { optionalEnum, optionalString, requiredEnum, requiredString, safeObject } from '../../utils/validation'
import { success } from '../../utils/api'
import { writeAuditLog } from '../../utils/audit'
import { notifyRoles } from '../../utils/notifications'

const CATEGORIES = ['ADMIN', 'BILLING', 'CONTRACT', 'PROJECT', 'PLATFORM', 'DOCUMENT', 'IT', 'HR', 'SECURITY', 'OTHER'] as const
const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.TICKET_WRITE)
  const body = safeObject(await readBody(event))
  const projectId = optionalString(body.projectId, 'Projet', { max: 191 })
  if (projectId) await assertProjectAccess(context, projectId, false)

  const ticket = await prisma.$transaction(async (tx) => {
    const number = await nextTicketNumber(tx, context.associationId)
    return tx.supportTicket.create({
      data: {
        associationId: context.associationId,
        number,
        requesterUserId: context.userId,
        requesterEmail: context.email,
        projectId,
        category: requiredEnum(body.category ?? 'OTHER', CATEGORIES, 'Catégorie'),
        priority: optionalEnum(body.priority, PRIORITIES, 'Priorité') || 'NORMAL',
        subject: requiredString(body.subject, 'Sujet', { max: 255 }),
        description: requiredString(body.description, 'Description', { min: 5, max: 20000 }),
      },
    })
  })
  await notifyRoles(context.associationId, ['ADMIN', 'MANAGER'], { type: 'ACTION', title: `Nouveau ticket ${ticket.number}`, message: ticket.subject, href: `/tickets/${ticket.id}` })
  await writeAuditLog(event, context, { action: 'TICKET_CREATED', entityType: 'SupportTicket', entityId: ticket.id, metadata: { number: ticket.number, category: ticket.category, priority: ticket.priority } })
  return success(ticket)
})
