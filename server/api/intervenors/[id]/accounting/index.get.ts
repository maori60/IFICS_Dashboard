import { getRouterParam } from 'h3'
import { assertIntervenorAccess, requirePermission } from '../../../../utils/auth'
import { PERMISSIONS } from '../../../../utils/constants'
import { prisma } from '../../../../utils/prisma'
import { jsonSafe, requireRouterId, success } from '../../../../utils/api'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.DOCUMENT_READ)
  const intervenorId = requireRouterId(getRouterParam(event, 'id'), 'Intervenant')
  await assertIntervenorAccess(context, intervenorId, false)
  const documents = await prisma.intervenorAccountingDocument.findMany({
    where: { intervenorId, archivedAt: null, intervenor: { associationId: context.associationId } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, projectId: true, type: true, status: true, title: true, description: true, periodMonth: true, periodYear: true, originalName: true, fileSize: true, sha256: true, version: true, adminComment: true, createdAt: true, reviewedAt: true },
  })
  return success(jsonSafe(documents))
})
