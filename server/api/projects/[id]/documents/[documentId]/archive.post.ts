import { getRouterParam } from 'h3'
import { assertProjectAccess, requirePermission } from '../../../../../utils/auth'
import { PERMISSIONS } from '../../../../../utils/constants'
import { prisma } from '../../../../../utils/prisma'
import { httpError, requireRouterId, success } from '../../../../../utils/api'
import { writeAuditLog } from '../../../../../utils/audit'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.PROJECT_WRITE)
  const projectId = requireRouterId(getRouterParam(event, 'id'), 'Projet')
  const documentId = requireRouterId(getRouterParam(event, 'documentId'), 'Document')
  await assertProjectAccess(context, projectId, true)
  const existing = await prisma.projectDocument.findFirst({ where: { id: documentId, projectId, archivedAt: null, project: { associationId: context.associationId } }, select: { id: true } })
  if (!existing) httpError(404, 'Document introuvable.', 'DOCUMENT_NOT_FOUND')
  const archived = await prisma.projectDocument.update({ where: { id: documentId }, data: { archivedAt: new Date() }, select: { id: true, archivedAt: true } })
  await writeAuditLog(event, context, { action: 'PROJECT_DOCUMENT_ARCHIVED', entityType: 'ProjectDocument', entityId: documentId, metadata: { projectId } })
  return success(archived)
})
