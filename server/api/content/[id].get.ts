import { getRouterParam } from 'h3'
import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { httpError, requireRouterId, success } from '../../utils/api'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.CONTENT_READ)
  const id = requireRouterId(getRouterParam(event, 'id'), 'Contenu')
  const entry = await prisma.cmsEntry.findFirst({
    where: { id, associationId: context.associationId },
  })
  if (!entry) httpError(404, 'Contenu introuvable.', 'CONTENT_NOT_FOUND')
  return success(entry)
})
