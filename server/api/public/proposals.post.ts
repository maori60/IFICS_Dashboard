import { readBody } from 'h3'
import { getPrimaryAssociationId } from '../../utils/association'
import { prisma } from '../../utils/prisma'
import { enforceRateLimit } from '../../utils/rate-limit'
import { moneyString, optionalInteger, optionalString, requiredEmail, requiredString, safeObject } from '../../utils/validation'
import { success } from '../../utils/api'
import { writeAuditLog } from '../../utils/audit'
import { notifyRoles } from '../../utils/notifications'

export default defineEventHandler(async (event) => {
  enforceRateLimit(event, 'proposal', 5, 60 * 60 * 1000)
  const associationId = await getPrimaryAssociationId()
  const body = safeObject(await readBody(event))
  const budgetRaw = moneyString(body.budget, 'Budget')
  const proposal = await prisma.projectProposal.create({ data: { associationId, organizationName: requiredString(body.organizationName, 'Organisation', { max: 200 }), contactName: requiredString(body.contactName, 'Contact', { max: 200 }), email: requiredEmail(body.email), phone: optionalString(body.phone, 'Téléphone', { max: 30 }), territory: optionalString(body.territory, 'Territoire', { max: 150 }), audience: optionalString(body.audience, 'Public'), issue: requiredString(body.issue, 'Besoin', { min: 20, max: 30000 }), proposalType: optionalString(body.proposalType, 'Type', { max: 150 }), timeframe: optionalString(body.timeframe, 'Calendrier', { max: 150 }), budget: budgetRaw, participantCount: optionalInteger(body.participantCount, 'Participants', { min: 0, max: 1000000 }), comment: optionalString(body.comment, 'Commentaire') } })
  await notifyRoles(associationId, ['ADMIN', 'MANAGER'], { type: 'ACTION', title: 'Nouvelle proposition de projet', message: `${proposal.organizationName} a soumis une proposition.`, href: `/proposals/${proposal.id}` })
  await writeAuditLog(event, null, { associationId, action: 'PUBLIC_PROJECT_PROPOSAL_CREATED', entityType: 'ProjectProposal', entityId: proposal.id })
  return success({ id: proposal.id, status: proposal.status })
})
