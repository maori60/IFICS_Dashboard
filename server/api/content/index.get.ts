import { getQuery } from 'h3'
import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { success } from '../../utils/api'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.CONTENT_READ)
  const query = getQuery(event)
  const kind = typeof query.kind === 'string' ? query.kind : undefined
  const entries = await prisma.cmsEntry.findMany({
    where: { associationId: context.associationId, archivedAt: null, ...(kind && ['PAGE', 'ARTICLE', 'NEWS', 'RND', 'ACTIVITY_REPORT'].includes(kind) ? { kind: kind as 'PAGE' | 'ARTICLE' | 'NEWS' | 'RND' | 'ACTIVITY_REPORT' } : {}) },
    orderBy: { updatedAt: 'desc' },
  })
  return success(entries)
})
