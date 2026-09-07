import { readBody } from 'h3'
import { prisma } from '../../../../utils/prisma'
import { enforceRateLimit } from '../../../../utils/rate-limit'
import { requiredEmail, safeObject } from '../../../../utils/validation'
import { success } from '../../../../utils/api'
import { notifyRoles } from '../../../../utils/notifications'
import { writeAuditLog } from '../../../../utils/audit'

const GENERIC_MESSAGE = 'Si ce compte est éligible, une demande de récupération MFA a été transmise à un administrateur IFICS.'

export default defineEventHandler(async (event) => {
  enforceRateLimit(event, 'mfa-recovery-request', 3, 60 * 60 * 1000)
  const body = safeObject(await readBody(event))
  const email = requiredEmail(body.email)

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, associationId: true, status: true, mfaEnabled: true },
  })

  if (user?.status === 'ACTIVE' && user.mfaEnabled) {
    const existing = await prisma.mfaResetRequest.findFirst({
      where: { userId: user.id, status: { in: ['PENDING', 'APPROVED'] } },
      orderBy: { requestedAt: 'desc' },
      select: { id: true },
    })
    if (!existing) {
      const request = await prisma.mfaResetRequest.create({ data: { associationId: user.associationId, userId: user.id } })
      await notifyRoles(user.associationId, ['ADMIN'], {
        type: 'SECURITY', title: 'Demande de récupération MFA',
        message: 'Un utilisateur demande la réinitialisation de son second facteur. Vérifiez son identité avant approbation.',
        href: '/dashboard/admin',
      })
      await writeAuditLog(event, null, {
        associationId: user.associationId, userId: user.id, action: 'MFA_RESET_REQUESTED',
        entityType: 'MfaResetRequest', entityId: request.id,
      })
    }
  }

  return success({ message: GENERIC_MESSAGE })
})
