import { readBody } from 'h3'
import { prisma } from '../../utils/prisma'
import { hashPassword, hashToken } from '../../utils/security'
import { httpError, success } from '../../utils/api'
import { requiredString, safeObject } from '../../utils/validation'
import { revokeUserSessions } from '../../utils/auth'
import { writeAuditLog } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  const body = safeObject(await readBody(event))
  const token = requiredString(body.token, 'Jeton d’activation', { min: 20, max: 200 })
  const password = requiredString(body.password, 'Mot de passe', { min: 12, max: 128 })

  const invitation = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      usedAt: true,
      user: { select: { associationId: true, status: true } },
    },
  })

  if (!invitation || invitation.usedAt || invitation.expiresAt <= new Date()) {
    httpError(400, 'Le lien d’activation est invalide ou expiré.', 'INVALID_ACTIVATION_TOKEN')
  }

  if (invitation.user.status === 'ACTIVE') {
    httpError(409, 'Ce compte est déjà actif.', 'USER_ALREADY_ACTIVE')
  }

  let passwordHash: string
  try {
    passwordHash = await hashPassword(password)
  }
  catch (error) {
    httpError(400, error instanceof Error ? error.message : 'Mot de passe invalide.', 'WEAK_PASSWORD')
  }

  const now = new Date()
  await prisma.$transaction([
    prisma.user.update({
      where: { id: invitation.userId },
      data: {
        passwordHash,
        passwordChangedAt: now,
        status: 'ACTIVE',
        resetToken: null,
        resetTokenExpiresAt: null,
      },
    }),
    prisma.passwordResetToken.updateMany({
      where: { userId: invitation.userId, usedAt: null },
      data: { usedAt: now },
    }),
  ])

  await revokeUserSessions(invitation.userId)
  await writeAuditLog(event, null, {
    associationId: invitation.user.associationId,
    userId: invitation.userId,
    action: 'USER_INVITATION_ACCEPTED',
  })

  return success({ activated: true })
})
