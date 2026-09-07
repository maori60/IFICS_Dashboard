import { getQuery } from 'h3'
import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { success } from '../../utils/api'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.AUDIT_READ)
  const query = getQuery(event)
  const page = Math.max(Number(query.page) || 1, 1)
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200)
  const action = typeof query.action === 'string' && query.action.trim() ? query.action.trim() : undefined
  const entityType = typeof query.entityType === 'string' && query.entityType.trim() ? query.entityType.trim() : undefined
  const userId = typeof query.userId === 'string' && query.userId.trim() ? query.userId.trim() : undefined
  const where = { associationId: context.associationId, ...(action ? { action } : {}), ...(entityType ? { entityType } : {}), ...(userId ? { userId } : {}) }
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit, include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } }),
    prisma.auditLog.count({ where }),
  ])
  return success({ items, page, limit, total, pages: Math.ceil(total / limit) })
})
