import { readBody } from 'h3'
import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { success } from '../../utils/api'
import { optionalString, safeObject } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.NOTIFICATION_READ)
  const body = safeObject(await readBody(event))
  const id = optionalString(body.id, 'Notification', { max: 191 })
  const result = id
    ? await prisma.notification.updateMany({ where: { id, userId: context.userId }, data: { readAt: new Date() } })
    : await prisma.notification.updateMany({ where: { userId: context.userId, readAt: null }, data: { readAt: new Date() } })
  return success({ updated: result.count })
})
