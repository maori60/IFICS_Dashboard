import { getRouterParam } from 'h3'
import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { httpError, jsonSafe, requireRouterId, success } from '../../utils/api'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.IT_READ)
  const id = requireRouterId(getRouterParam(event, 'id'), 'Matériel')
  const asset = await prisma.asset.findFirst({ where: { id, associationId: context.associationId } })
  if (!asset) httpError(404, 'Matériel introuvable.', 'ASSET_NOT_FOUND')

  const [documents, finance] = await Promise.all([
    prisma.assetDocument.findMany({
      where: { assetId: id, archivedAt: null },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.associationFinanceSettings.findUnique({
      where: { associationId: context.associationId },
      select: { maxAssetDocuments: true, maxAssetDocumentMb: true },
    }),
  ])

  return success(jsonSafe({
    ...asset,
    documents,
    documentLimits: {
      maxCount: finance?.maxAssetDocuments ?? 20,
      maxMb: finance?.maxAssetDocumentMb ?? 10,
    },
  }))
})