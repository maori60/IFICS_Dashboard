import { readBody } from 'h3'
import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { httpError, success } from '../../utils/api'
import { optionalDate, optionalString, safeObject } from '../../utils/validation'
import { writeAuditLog } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.SETTINGS_MANAGE)
  if (!context.mfaVerified) httpError(403, 'Validation MFA requise pour modifier la maintenance.', 'ADMIN_MFA_REQUIRED')
  const body = safeObject(await readBody(event))
  const enabled = body.enabled === true
  const startsAt = optionalDate(body.startsAt, 'Début de maintenance')
  const endsAt = optionalDate(body.endsAt, 'Fin de maintenance')
  if (startsAt && endsAt && endsAt <= startsAt) {
    httpError(400, 'La fin de maintenance doit être postérieure au début.', 'INVALID_MAINTENANCE_RANGE')
  }
  const maintenance = await prisma.association.update({
    where: { id: context.associationId },
    data: {
      maintenanceEnabled: enabled,
      maintenanceMessage: optionalString(body.message, 'Message de maintenance', { max: 1000 }) || (enabled ? 'Une maintenance IFICS est en cours. Merci de réessayer ultérieurement.' : null),
      maintenanceStartsAt: startsAt,
      maintenanceEndsAt: endsAt,
    },
    select: { maintenanceEnabled: true, maintenanceMessage: true, maintenanceStartsAt: true, maintenanceEndsAt: true },
  })
  await writeAuditLog(event, context, {
    action: enabled ? 'MAINTENANCE_ENABLED' : 'MAINTENANCE_DISABLED', entityType: 'Association', entityId: context.associationId,
    metadata: { startsAt, endsAt },
  })
  return success(maintenance)
})
