import { getQuery } from 'h3'
import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { success } from '../../utils/api'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.NOTIFICATION_READ)
  const query = getQuery(event)
  const unreadOnly = query.unread === 'true'
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 100)
  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({ where: { userId: context.userId, ...(unreadOnly ? { readAt: null } : {}) }, orderBy: { createdAt: 'desc' }, take: limit }),
    prisma.notification.count({ where: { userId: context.userId, readAt: null } }),
  ])
  return success({ items, unreadCount })
})
