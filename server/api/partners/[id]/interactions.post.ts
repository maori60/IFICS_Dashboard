import { getRouterParam, readBody } from 'h3'
import { requirePermission } from '../../../utils/auth'
import { PERMISSIONS } from '../../../utils/constants'
import { prisma } from '../../../utils/prisma'
import { httpError, requireRouterId, success } from '../../../utils/api'
import { optionalDate, optionalString, requiredString, safeObject } from '../../../utils/validation'
import { writeAuditLog } from '../../../utils/audit'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.PARTNER_WRITE)
  const partnerId = requireRouterId(getRouterParam(event, 'id'), 'Partenaire')
  const body = safeObject(await readBody(event))
  const partner = await prisma.partner.findFirst({ where: { id: partnerId, associationId: context.associationId }, select: { id: true } })
  if (!partner) httpError(404, 'Partenaire introuvable.', 'PARTNER_NOT_FOUND')
  const interaction = await prisma.partnerInteraction.create({ data: { partnerId, authorUserId: context.userId, occurredAt: optionalDate(body.occurredAt, 'Date') || new Date(), kind: requiredString(body.kind, 'Type', { max: 80 }), summary: requiredString(body.summary, 'Résumé', { max: 20000 }), nextAction: optionalString(body.nextAction, 'Prochaine action'), nextActionAt: optionalDate(body.nextActionAt, 'Date prochaine action') } })
  await writeAuditLog(event, context, { action: 'PARTNER_INTERACTION_CREATED', entityType: 'PartnerInteraction', entityId: interaction.id, metadata: { partnerId } })
  return success(interaction)
})
