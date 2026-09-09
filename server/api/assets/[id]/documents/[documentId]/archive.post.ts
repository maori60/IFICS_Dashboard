import { getRouterParam } from 'h3'
import { requirePermission } from '../../../../../utils/auth'
import { PERMISSIONS } from '../../../../../utils/constants'
import { prisma } from '../../../../../utils/prisma'
import { httpError, requireRouterId, success } from '../../../../../utils/api'
import { writeAuditLog } from '../../../../../utils/audit'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.IT_WRITE)
  const assetId = requireRouterId(getRouterParam(event, 'id'), 'Matériel')
  const documentId = requireRouterId(getRouterParam(event, 'documentId'), 'Document')

  const asset = await prisma.asset.findFirst({
    where: { id: assetId, associationId: context.associationId },
    select: { id: true },
  })
  if (!asset) httpError(404, 'Matériel introuvable.', 'ASSET_NOT_FOUND')

  const existing = await prisma.assetDocument.findFirst({
    where: { id: documentId, assetId, archivedAt: null },
    select: { id: true, type: true, sha256: true },
  })
  if (!existing) httpError(404, 'Document introuvable.', 'ASSET_DOCUMENT_NOT_FOUND')

  const document = await prisma.assetDocument.update({
    where: { id: documentId },
    data: { archivedAt: new Date() },
  })

  await writeAuditLog(event, context, {
    action: 'ASSET_DOCUMENT_ARCHIVED',
    entityType: 'AssetDocument',
    entityId: documentId,
    metadata: { assetId, type: existing.type, sha256: existing.sha256 },
  })

  return success({ id: document.id, archivedAt: document.archivedAt })
})