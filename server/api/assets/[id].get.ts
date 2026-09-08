import { getRouterParam } from 'h3'
import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { httpError, requireRouterId, success } from '../../utils/api'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.IT_READ)
  const id = requireRouterId(getRouterParam(event, 'id'), 'Matériel')
  const asset = await prisma.asset.findFirst({ where: { id, associationId: context.associationId } })
  if (!asset) httpError(404, 'Matériel introuvable.', 'ASSET_NOT_FOUND')
  return success(asset)
})
