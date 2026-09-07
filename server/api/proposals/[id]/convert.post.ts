import { getRouterParam } from 'h3'
import { requirePermission } from '../../../utils/auth'
import { PERMISSIONS } from '../../../utils/constants'
import { prisma } from '../../../utils/prisma'
import { httpError, requireRouterId, success } from '../../../utils/api'
import { writeAuditLog } from '../../../utils/audit'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.PROJECT_WRITE)
  const id = requireRouterId(getRouterParam(event, 'id'), 'Proposition')
  const proposal = await prisma.projectProposal.findFirst({ where: { id, associationId: context.associationId, status: 'ACCEPTED', convertedProjectId: null } })
  if (!proposal) httpError(409, 'La proposition doit être acceptée et non convertie.', 'PROPOSAL_NOT_CONVERTIBLE')
  const result = await prisma.$transaction(async (tx) => {
    const client = await tx.client.create({ data: { associationId: context.associationId, type: 'AUTRE', name: proposal.organizationName, email: proposal.email, phone1: proposal.phone, addressLine1: 'À compléter', postalCode: 'À compléter', city: proposal.territory || 'À compléter', country: 'France', notes: `Client créé automatiquement depuis la proposition ${proposal.id}. Coordonnées à compléter.` } })
    const project = await tx.project.create({ data: { associationId: context.associationId, title: `${proposal.proposalType || 'Projet'} — ${proposal.organizationName}`, description: `${proposal.issue}${proposal.comment ? `\n\n${proposal.comment}` : ''}`, status: 'DRAFT', plannedBudget: proposal.budget, projectClients: { create: { clientId: client.id, isMainClient: true } } } })
    await tx.projectProposal.update({ where: { id }, data: { status: 'CONVERTED', convertedProjectId: project.id, assignedUserId: context.userId } })
    return { client, project }
  })
  await writeAuditLog(event, context, { action: 'PROJECT_PROPOSAL_CONVERTED', entityType: 'ProjectProposal', entityId: id, metadata: { clientId: result.client.id, projectId: result.project.id } })
  return success(result)
})
