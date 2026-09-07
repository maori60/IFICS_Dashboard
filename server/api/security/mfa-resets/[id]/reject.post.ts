import { getRouterParam } from 'h3'
import { requirePermission } from '../../../../utils/auth'
import { PERMISSIONS } from '../../../../utils/constants'
import { prisma } from '../../../../utils/prisma'
import { requireRouterId, success, httpError } from '../../../../utils/api'
import { writeAuditLog } from '../../../../utils/audit'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.SECURITY_MFA_RESET)
  if (!context.mfaVerified) httpError(403, 'Validation MFA administrateur requise.', 'ADMIN_MFA_REQUIRED')
  const id = requireRouterId(getRouterParam(event, 'id'), 'Demande MFA')
  const result = await prisma.mfaResetRequest.updateMany({
    where: { id, associationId: context.associationId, status: 'PENDING' },
    data: { status: 'REJECTED', rejectedAt: new Date() },
  })
  if (!result.count) httpError(404, 'Demande MFA en attente introuvable.', 'MFA_RESET_NOT_FOUND')
  await writeAuditLog(event, context, { action: 'MFA_RESET_REJECTED', entityType: 'MfaResetRequest', entityId: id })
  return success({ rejected: true })
})
