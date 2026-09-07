import { readBody } from 'h3'
import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { httpError, success } from '../../utils/api'
import { requiredString, safeObject } from '../../utils/validation'
import { writeAuditLog } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.INTERVENOR_WRITE)
  const body = safeObject(await readBody(event))
  const id = requiredString(body.id, 'Intervenant', { max: 191 })
  const existing = await prisma.intervenor.findFirst({ where: { id, associationId: context.associationId, archivedAt: null }, select: { id: true } })
  if (!existing) httpError(404, 'Intervenant introuvable.', 'INTERVENOR_NOT_FOUND')

  const archived = await prisma.intervenor.update({ where: { id }, data: { archivedAt: new Date(), status: 'INACTIVE' }, select: { id: true, archivedAt: true } })
  await writeAuditLog(event, context, { action: 'INTERVENOR_ARCHIVED', entityType: 'Intervenor', entityId: id })
  return success(archived)
})
