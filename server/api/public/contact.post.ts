import { readBody } from 'h3'
import { getPrimaryAssociationId } from '../../utils/association'
import { prisma } from '../../utils/prisma'
import { enforceRateLimit } from '../../utils/rate-limit'
import { optionalString, requiredEmail, requiredString, safeObject } from '../../utils/validation'
import { success } from '../../utils/api'
import { notifyRoles } from '../../utils/notifications'
import { writeAuditLog } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  enforceRateLimit(event, 'contact', 10, 60 * 60 * 1000)
  const associationId = await getPrimaryAssociationId()
  const body = safeObject(await readBody(event))
  const request = await prisma.contactRequest.create({ data: { associationId, reason: requiredString(body.reason, 'Motif', { max: 100 }), name: requiredString(body.name, 'Nom', { max: 200 }), organization: optionalString(body.organization, 'Organisation', { max: 200 }), email: requiredEmail(body.email), phone: optionalString(body.phone, 'Téléphone', { max: 30 }), message: requiredString(body.message, 'Message', { min: 10, max: 30000 }) } })
  await notifyRoles(associationId, ['ADMIN', 'MANAGER'], { type: 'ACTION', title: 'Nouveau message public', message: `${request.name} — ${request.reason}`, href: `/contact-requests/${request.id}` })
  await writeAuditLog(event, null, { associationId, action: 'PUBLIC_CONTACT_REQUEST_CREATED', entityType: 'ContactRequest', entityId: request.id })
  return success({ id: request.id, received: true })
})
