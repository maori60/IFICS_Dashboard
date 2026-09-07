import { readBody } from 'h3'
import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { httpError, success } from '../../utils/api'
import { requiredString, safeObject } from '../../utils/validation'
import { writeAuditLog } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.CLIENT_WRITE)
  const body = safeObject(await readBody(event))
  const clientId = requiredString(body.id, 'Client', { max: 191 })

  const existing = await prisma.client.findFirst({
    where: {
      id: clientId,
      associationId: context.associationId,
      archivedAt: null,
    },
    select: { id: true, name: true },
  })

  if (!existing) {
    httpError(404, 'Client introuvable.', 'CLIENT_NOT_FOUND')
  }

  const archived = await prisma.client.update({
    where: { id: clientId },
    data: {
      archivedAt: new Date(),
      status: 'INACTIVE',
    },
    select: { id: true, name: true, archivedAt: true, status: true },
  })

  await writeAuditLog(event, context, {
    action: 'CLIENT_ARCHIVED',
    entityType: 'Client',
    entityId: clientId,
    metadata: { name: existing.name },
  })

  return success(archived)
})
