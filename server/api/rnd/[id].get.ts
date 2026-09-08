import { getRouterParam } from 'h3'
import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { httpError, requireRouterId, success } from '../../utils/api'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.RND_READ)
  const id = requireRouterId(getRouterParam(event, 'id'), 'Projet R&D')
  const item = await prisma.rndProject.findFirst({ where: { id, associationId: context.associationId } })
  if (!item) httpError(404, 'Projet R&D introuvable.', 'RND_NOT_FOUND')
  return success(item)
})
