import { getQuery } from 'h3'
import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { success } from '../../utils/api'

function optionalDate(value: unknown, endOfDay = false): Date | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined
  const suffix = endOfDay ? 'T23:59:59.999' : 'T00:00:00.000'
  const date = new Date(`${value.trim()}${suffix}`)
  return Number.isNaN(date.getTime()) ? undefined : date
}

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.AUDIT_READ)
  const query = getQuery(event)
  const page = Math.max(Number(query.page) || 1, 1)
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200)
  const action = typeof query.action === 'string' && query.action.trim() ? query.action.trim() : undefined
  const entityType = typeof query.entityType === 'string' && query.entityType.trim() ? query.entityType.trim() : undefined
  const entityId = typeof query.entityId === 'string' && query.entityId.trim() ? query.entityId.trim() : undefined
  const userId = typeof query.userId === 'string' && query.userId.trim() ? query.userId.trim() : undefined
  const outcome = query.outcome === 'SUCCESS' || query.outcome === 'FAILURE' ? query.outcome : undefined
  const from = optionalDate(query.from)
  const to = optionalDate(query.to, true)

  const where = {
    associationId: context.associationId,
    ...(action ? { action } : {}),
    ...(entityType ? { entityType } : {}),
    ...(entityId ? { entityId } : {}),
    ...(userId ? { userId } : {}),
    ...(outcome ? { outcome } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
  }

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
  ])

  return success({ items, page, limit, total, pages: Math.max(Math.ceil(total / limit), 1) })
})