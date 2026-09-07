import { getRouterParam, readBody } from 'h3'
import { requirePermission } from '../../../utils/auth'
import { PERMISSIONS } from '../../../utils/constants'
import { prisma } from '../../../utils/prisma'
import { httpError, requireRouterId, success } from '../../../utils/api'
import { requiredEnum, safeObject } from '../../../utils/validation'
import { writeAuditLog } from '../../../utils/audit'
const STATUSES = ['NEW', 'QUALIFYING', 'CONTACTED', 'STUDY', 'NEGOTIATION', 'ACCEPTED', 'REJECTED'] as const
export default defineEventHandler(async (event) => { const context = await requirePermission(event, PERMISSIONS.PROJECT_WRITE); const id = requireRouterId(getRouterParam(event, 'id'), 'Proposition'); const body = safeObject(await readBody(event)); const status = requiredEnum(body.status, STATUSES, 'Statut'); const existing = await prisma.projectProposal.findFirst({ where: { id, associationId: context.associationId, status: { not: 'CONVERTED' } }, select: { id: true, status: true } }); if (!existing) httpError(404, 'Proposition introuvable.', 'PROPOSAL_NOT_FOUND'); const updated = await prisma.projectProposal.update({ where: { id }, data: { status, assignedUserId: context.userId } }); await writeAuditLog(event, context, { action: 'PROJECT_PROPOSAL_STATUS_CHANGED', entityType: 'ProjectProposal', entityId: id, metadata: { from: existing.status, to: status } }); return success(updated) })
