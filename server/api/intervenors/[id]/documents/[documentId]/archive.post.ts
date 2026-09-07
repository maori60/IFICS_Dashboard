import { getRouterParam } from 'h3'
import { requirePermission } from '../../../../../utils/auth'
import { PERMISSIONS } from '../../../../../utils/constants'
import { prisma } from '../../../../../utils/prisma'
import { httpError, requireRouterId, success } from '../../../../../utils/api'
import { writeAuditLog } from '../../../../../utils/audit'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.DOCUMENT_REVIEW)
  const intervenorId = requireRouterId(getRouterParam(event, 'id'), 'Intervenant')
  const documentId = requireRouterId(getRouterParam(event, 'documentId'), 'Document')
  const existing = await prisma.intervenorDocument.findFirst({ where: { id: documentId, intervenorId, archivedAt: null, intervenor: { associationId: context.associationId } }, select: { id: true } })
  if (!existing) httpError(404, 'Document introuvable.', 'DOCUMENT_NOT_FOUND')
  const archived = await prisma.intervenorDocument.update({ where: { id: documentId }, data: { archivedAt: new Date() }, select: { id: true, archivedAt: true } })
  await writeAuditLog(event, context, { action: 'INTERVENOR_DOCUMENT_ARCHIVED', entityType: 'IntervenorDocument', entityId: documentId, metadata: { intervenorId } })
  return success(archived)
})
