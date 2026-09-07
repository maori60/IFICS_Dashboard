import { getRouterParam, readBody } from 'h3'
import { assertClientAccess, requirePermission } from '../../../../utils/auth'
import { PERMISSIONS } from '../../../../utils/constants'
import { prisma } from '../../../../utils/prisma'
import { httpError, requireRouterId, success } from '../../../../utils/api'
import {
  optionalEmail,
  optionalString,
  requiredString,
  safeObject,
} from '../../../../utils/validation'
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
    select: { id: true },
  })
  if (!existing) httpError(404, 'Contact introuvable.', 'CONTACT_NOT_FOUND')

  const body = safeObject(await readBody(event))
  const isPrimary = body.isPrimary === true

  const contact = await prisma.$transaction(async (tx) => {
    if (isPrimary) {
      await tx.clientContact.updateMany({
        where: { clientId, isPrimary: true, id: { not: contactId } },
        data: { isPrimary: false },
      })
    }

    return tx.clientContact.update({
      where: { id: contactId },
      data: {
        firstName: requiredString(body.firstName, 'Prénom', { max: 100 }),
        lastName: requiredString(body.lastName, 'Nom', { max: 100 }),
        jobTitle: optionalString(body.jobTitle, 'Fonction', { max: 100 }),
        email: optionalEmail(body.email),
        phone1: optionalString(body.phone1, 'Téléphone principal', { max: 30 }),
        phone2: optionalString(body.phone2, 'Téléphone secondaire', { max: 30 }),
        isPrimary,
        notes: optionalString(body.notes, 'Notes'),
      },
    })
  })

  await writeAuditLog(event, context, {
    action: 'CLIENT_CONTACT_UPDATED',
    entityType: 'ClientContact',
    entityId: contactId,
    metadata: { clientId },
  })

  return success(contact)
})
