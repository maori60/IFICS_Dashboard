import { readBody } from 'h3'
import { prisma } from '../../../utils/prisma'
import { hashPassword, hashToken } from '../../../utils/security'
import { revokeUserSessions } from '../../../utils/auth'
import { httpError, success } from '../../../utils/api'
import { requiredString, safeObject } from '../../../utils/validation'
import { writeAuditLog } from '../../../utils/audit'

export default defineEventHandler(async (event) => {
  const body = safeObject(await readBody(event))
  const token = requiredString(body.token, 'Jeton de réinitialisation', { min: 20, max: 200 })
  const newPassword = requiredString(body.newPassword, 'Nouveau mot de passe', { min: 12, max: 128 })
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true, user: { select: { associationId: true, status: true } } },
  })
  if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) httpError(400, 'Le lien est invalide ou expiré.', 'INVALID_RESET_TOKEN')
  const passwordHash = await hashPassword(newPassword)
  const now = new Date()
  const activatesInvitation = resetToken.user.status === 'INACTIVE'
  await prisma.$transaction([
    prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash, passwordChangedAt: now, resetToken: null, resetTokenExpiresAt: null, ...(activatesInvitation ? { status: 'ACTIVE' } : {}) } }),
    prisma.passwordResetToken.updateMany({ where: { userId: resetToken.userId, usedAt: null }, data: { usedAt: now } }),
  ])
  await revokeUserSessions(resetToken.userId)
  await writeAuditLog(event, null, { associationId: resetToken.user.associationId, userId: resetToken.userId, action: activatesInvitation ? 'USER_INVITATION_ACTIVATED' : 'PASSWORD_RESET_COMPLETED' })
  return success({ changed: true, activated: activatesInvitation })
})
