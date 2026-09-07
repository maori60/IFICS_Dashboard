import { getRouterParam, readBody } from 'h3'
import { hasPermission, requirePermission } from '../../../utils/auth'
import { PERMISSIONS } from '../../../utils/constants'
import { prisma } from '../../../utils/prisma'
import { httpError, requireRouterId, success } from '../../../utils/api'
import { optionalDate, requiredEnum, safeObject } from '../../../utils/validation'
import { writeAuditLog } from '../../../utils/audit'

const STATUSES = ['DRAFT', 'REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'] as const
const TRANSITIONS: Record<string, string[]> = { DRAFT: ['REVIEW'], REVIEW: ['DRAFT', 'APPROVED'], APPROVED: ['DRAFT', 'SCHEDULED', 'PUBLISHED'], SCHEDULED: ['PUBLISHED', 'ARCHIVED'], PUBLISHED: ['ARCHIVED'], ARCHIVED: ['DRAFT'] }

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.CONTENT_WRITE)
  const id = requireRouterId(getRouterParam(event, 'id'), 'Contenu')
  const body = safeObject(await readBody(event))
  const status = requiredEnum(body.status, STATUSES, 'Statut')
  const entry = await prisma.cmsEntry.findFirst({ where: { id, associationId: context.associationId }, select: { id: true, status: true } })
  if (!entry) httpError(404, 'Contenu introuvable.', 'CONTENT_NOT_FOUND')
  if (!(TRANSITIONS[entry.status] || []).includes(status)) httpError(409, `Transition ${entry.status} → ${status} interdite.`, 'INVALID_CONTENT_TRANSITION')
  if (['APPROVED', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'].includes(status) && !hasPermission(context, PERMISSIONS.CONTENT_PUBLISH)) httpError(403, 'Permission de publication requise.', 'PUBLISH_PERMISSION_REQUIRED')
  const scheduledAt = status === 'SCHEDULED' ? optionalDate(body.scheduledAt, 'Date de publication') : null
  if (status === 'SCHEDULED' && (!scheduledAt || scheduledAt <= new Date())) httpError(400, 'La publication programmée doit être future.', 'INVALID_SCHEDULE')
  const now = new Date()
  const updated = await prisma.cmsEntry.update({ where: { id }, data: {
    status, reviewedByUserId: ['APPROVED', 'SCHEDULED', 'PUBLISHED'].includes(status) ? context.userId : undefined,
    scheduledAt: status === 'SCHEDULED' ? scheduledAt : status === 'PUBLISHED' ? null : undefined,
    publishedAt: status === 'PUBLISHED' ? now : undefined, archivedAt: status === 'ARCHIVED' ? now : status === 'DRAFT' ? null : undefined,
  } })
  await writeAuditLog(event, context, { action: 'CONTENT_STATUS_CHANGED', entityType: 'CmsEntry', entityId: id, metadata: { from: entry.status, to: status, scheduledAt } })
  return success(updated)
})
