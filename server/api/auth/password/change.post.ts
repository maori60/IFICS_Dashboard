import { readBody } from 'h3'
import { requireAuth, revokeUserSessions } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { hashPassword, verifyPassword } from '../../../utils/security'
import { httpError, success } from '../../../utils/api'
import { requiredString, safeObject } from '../../../utils/validation'
import { writeAuditLog } from '../../../utils/audit'

export default defineEventHandler(async (event) => {
  const context = await requireAuth(event)
  const body = safeObject(await readBody(event))
  const currentPassword = requiredString(body.currentPassword, 'Mot de passe actuel', { min: 1, max: 128 })
  const newPassword = requiredString(body.newPassword, 'Nouveau mot de passe', { min: 12, max: 128 })

  const user = await prisma.user.findUnique({
    where: { id: context.userId },
    select: { passwordHash: true },
  })

  if (!user || !await verifyPassword(currentPassword, user.passwordHash)) {
    await writeAuditLog(event, context, {
      action: 'PASSWORD_CHANGE',
      outcome: 'FAILURE',
      metadata: { reason: 'invalid_current_password' },
    })
    httpError(400, 'Le mot de passe actuel est incorrect.', 'INVALID_CURRENT_PASSWORD')
  }

  if (await verifyPassword(newPassword, user.passwordHash)) {
    httpError(400, 'Le nouveau mot de passe doit être différent de l’ancien.', 'PASSWORD_REUSE')
  }

  const passwordHash = await hashPassword(newPassword)

  await prisma.user.update({
    where: { id: context.userId },
    data: {
      passwordHash,
      passwordChangedAt: new Date(),
      resetToken: null,
      resetTokenExpiresAt: null,
    },
  })

  await prisma.passwordResetToken.updateMany({
    where: { userId: context.userId, usedAt: null },
    data: { usedAt: new Date() },
  })
  await revokeUserSessions(context.userId, context.sessionId)
  await writeAuditLog(event, context, { action: 'PASSWORD_CHANGE' })

  return success({ changed: true })
})
