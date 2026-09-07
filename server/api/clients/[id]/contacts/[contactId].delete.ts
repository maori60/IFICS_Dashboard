import { getRouterParam } from 'h3'
import { assertClientAccess, requirePermission } from '../../../../utils/auth'
import { PERMISSIONS } from '../../../../utils/constants'
import { prisma } from '../../../../utils/prisma'
import { httpError, requireRouterId, success } from '../../../../utils/api'
import { writeAuditLog } from '../../../../utils/audit'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.CLIENT_WRITE)
  const clientId = requireRouterId(getRouterParam(event, 'id'), 'Client')
  const contactId = requireRouterId(getRouterParam(event, 'contactId'), 'Contact')
  await assertClientAccess(context, clientId, true)

  const existing = await prisma.clientContact.findFirst({
    where: {
      id: contactId,
      clientId,
      client: { associationId: context.associationId, archivedAt: null },
    },
    select: { id: true, isPrimary: true },
  })
  if (!existing) httpError(404, 'Contact introuvable.', 'CONTACT_NOT_FOUND')

  await prisma.clientContact.delete({ where: { id: contactId } })

  await writeAuditLog(event, context, {
    action: 'CLIENT_CONTACT_DELETED',
    entityType: 'ClientContact',
    entityId: contactId,
    metadata: { clientId, wasPrimary: existing.isPrimary },
  })

  return success({ deleted: true })
})
