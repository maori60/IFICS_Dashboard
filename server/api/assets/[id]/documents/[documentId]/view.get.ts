import { getRouterParam, setHeader } from 'h3'
import { requirePermission } from '../../../../../utils/auth'
import { PERMISSIONS } from '../../../../../utils/constants'
import { prisma } from '../../../../../utils/prisma'
import { contentDispositionFilename, readStoredFile } from '../../../../../utils/files'
import { httpError, requireRouterId } from '../../../../../utils/api'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.IT_READ)
  const assetId = requireRouterId(getRouterParam(event, 'id'), 'Matériel')
  const documentId = requireRouterId(getRouterParam(event, 'documentId'), 'Document')

  const asset = await prisma.asset.findFirst({
    where: { id: assetId, associationId: context.associationId },
    select: { id: true },
  })
  if (!asset) httpError(404, 'Matériel introuvable.', 'ASSET_NOT_FOUND')

  const document = await prisma.assetDocument.findFirst({
    where: { id: documentId, assetId, archivedAt: null },
  })
  if (!document) httpError(404, 'Document introuvable.', 'ASSET_DOCUMENT_NOT_FOUND')

  const file = await readStoredFile(document.filePath)
  setHeader(event, 'Content-Type', 'application/pdf')
  setHeader(event, 'Content-Disposition', `inline; filename*=UTF-8''${contentDispositionFilename(document.originalName)}`)
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  return file
})