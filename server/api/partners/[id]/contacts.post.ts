import { getRouterParam, readBody } from 'h3'
import { requirePermission } from '../../../utils/auth'
import { PERMISSIONS } from '../../../utils/constants'
import { prisma } from '../../../utils/prisma'
import { httpError, requireRouterId, success } from '../../../utils/api'
import { optionalEmail, optionalString, requiredString, safeObject } from '../../../utils/validation'
import { writeAuditLog } from '../../../utils/audit'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.PARTNER_WRITE)
  const partnerId = requireRouterId(getRouterParam(event, 'id'), 'Partenaire')
  const body = safeObject(await readBody(event))
  const partner = await prisma.partner.findFirst({ where: { id: partnerId, associationId: context.associationId }, select: { id: true } })
  if (!partner) httpError(404, 'Partenaire introuvable.', 'PARTNER_NOT_FOUND')
  const isPrimary = body.isPrimary === true
  const contact = await prisma.$transaction(async (tx) => {
    if (isPrimary) await tx.partnerContact.updateMany({ where: { partnerId, isPrimary: true }, data: { isPrimary: false } })
    return tx.partnerContact.create({ data: { partnerId, firstName: requiredString(body.firstName, 'Prénom', { max: 100 }), lastName: requiredString(body.lastName, 'Nom', { max: 100 }), jobTitle: optionalString(body.jobTitle, 'Fonction', { max: 150 }), email: optionalEmail(body.email), phone: optionalString(body.phone, 'Téléphone', { max: 30 }), isPrimary, notes: optionalString(body.notes, 'Notes') } })
  })
  await writeAuditLog(event, context, { action: 'PARTNER_CONTACT_CREATED', entityType: 'PartnerContact', entityId: contact.id, metadata: { partnerId } })
  return success(contact)
})
