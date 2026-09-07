import { getRouterParam } from 'h3'
import { assertProjectAccess, requirePermission } from '../../../utils/auth'
import { PERMISSIONS, ROLE_CODES } from '../../../utils/constants'
import { prisma } from '../../../utils/prisma'
import { jsonSafe, requireRouterId, success } from '../../../utils/api'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.DOCUMENT_READ)
  const projectId = requireRouterId(getRouterParam(event, 'id'), 'Projet')
  await assertProjectAccess(context, projectId, false)

  const visibility = context.roleCode === ROLE_CODES.CLIENT
    ? 'CLIENT_VISIBLE'
    : context.roleCode === ROLE_CODES.INTERVENOR
      ? 'INTERVENOR_VISIBLE'
      : undefined

  const documents = await prisma.projectDocument.findMany({
    where: { projectId, archivedAt: null, project: { associationId: context.associationId }, ...(visibility ? { visibility } : {}) },
    orderBy: [{ type: 'asc' }, { version: 'desc' }, { createdAt: 'desc' }],
    select: { id: true, type: true, visibility: true, title: true, originalName: true, mimeType: true, fileSize: true, sha256: true, version: true, createdAt: true, updatedAt: true },
  })

  return success(jsonSafe(documents))
})
