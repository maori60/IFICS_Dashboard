import { getRouterParam, readMultipartFormData } from 'h3'
import { requirePermission } from '../../../../utils/auth'
import { PERMISSIONS } from '../../../../utils/constants'
import { prisma } from '../../../../utils/prisma'
import { httpError, jsonSafe, requireRouterId, success } from '../../../../utils/api'
import { maxUploadBytes, storePdf } from '../../../../utils/files'
import { requiredEnum } from '../../../../utils/validation'
import { writeAuditLog } from '../../../../utils/audit'

const TYPES = ['PURCHASE_INVOICE', 'WARRANTY', 'RECEIPT', 'MANUAL', 'CERTIFICATE', 'PHOTO', 'OTHER'] as const

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.IT_WRITE)
  const assetId = requireRouterId(getRouterParam(event, 'id'), 'Matériel')
  const asset = await prisma.asset.findFirst({ where: { id: assetId, associationId: context.associationId }, select: { id: true } })
  if (!asset) httpError(404, 'Matériel introuvable.', 'ASSET_NOT_FOUND')

  const settings = await prisma.associationFinanceSettings.findUnique({
    where: { associationId: context.associationId },
    select: { maxAssetDocuments: true, maxAssetDocumentMb: true },
  })
  const maxCount = settings?.maxAssetDocuments ?? 20
  const configuredMaxBytes = (settings?.maxAssetDocumentMb ?? 10) * 1024 * 1024
  const maxBytes = Math.min(maxUploadBytes(), configuredMaxBytes)
  const activeCount = await prisma.assetDocument.count({ where: { assetId, archivedAt: null } })
  if (activeCount >= maxCount) {
    httpError(400, `Ce matériel a atteint la limite de ${maxCount} document(s).`, 'ASSET_DOCUMENT_LIMIT_REACHED')
  }

  const parts = await readMultipartFormData(event)
  const file = parts?.find(part => part.name === 'file')
  if (!file?.filename || !file.data) httpError(400, 'Fichier PDF manquant.', 'FILE_REQUIRED')
  const type = requiredEnum(parts?.find(part => part.name === 'type')?.data.toString() || 'OTHER', TYPES, 'Type de document')
  const title = parts?.find(part => part.name === 'title')?.data.toString().trim().slice(0, 255) || null
  const stored = await storePdf('assets', assetId, file.filename, file.data, { maxBytes })

  const document = await prisma.assetDocument.create({
    data: { assetId, uploadedByUserId: context.userId, type, title, ...stored },
  })

  await writeAuditLog(event, context, {
    action: 'ASSET_DOCUMENT_UPLOADED',
    entityType: 'AssetDocument',
    entityId: document.id,
    metadata: { assetId, type, fileSize: document.fileSize.toString(), sha256: document.sha256 },
  })

  return success(jsonSafe(document))
})