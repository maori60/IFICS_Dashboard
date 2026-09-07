import { getRouterParam, readBody } from 'h3'
import { requirePermission, revokeUserSessions } from '../../../../utils/auth'
import { PERMISSIONS } from '../../../../utils/constants'
import { prisma } from '../../../../utils/prisma'
import { createOpaqueToken, hashPassword } from '../../../../utils/security'
import { sendMail } from '../../../../utils/mail'
import { httpError, requireRouterId, success } from '../../../../utils/api'
import { optionalString, safeObject } from '../../../../utils/validation'
import { writeAuditLog } from '../../../../utils/audit'

function generatedPassword(): string {
  return `If!${createOpaqueToken(15)}aA1`
}

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.USER_MANAGE)
  const userId = requireRouterId(getRouterParam(event, 'id'), 'Utilisateur')
  const body = safeObject(await readBody(event))

  const user = await prisma.user.findFirst({
    where: { id: userId, associationId: context.associationId },
    select: { id: true, firstName: true, email: true },
  })

  if (!user) httpError(404, 'Utilisateur introuvable.', 'USER_NOT_FOUND')

  const providedPassword = optionalString(body.password, 'Mot de passe', { max: 128 })
  const temporaryPassword = providedPassword || generatedPassword()
  let passwordHash: string

  try {
    passwordHash = await hashPassword(temporaryPassword)
  }
  catch (error) {
    httpError(400, error instanceof Error ? error.message : 'Mot de passe invalide.', 'WEAK_PASSWORD')
  }

  const now = new Date()
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        passwordChangedAt: now,
        resetToken: null,
        resetTokenExpiresAt: null,
      },
    }),
    prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: now },
    }),
  ])

  await revokeUserSessions(userId)

  let emailDelivered = false
  try {
    emailDelivered = await sendMail({
      to: user.email,
      subject: 'Nouveau mot de passe IFICS',
      text: `Bonjour ${user.firstName},\n\nUn administrateur a réinitialisé votre mot de passe IFICS.\n\nMot de passe temporaire : ${temporaryPassword}\n\nConnectez-vous puis remplacez-le par un mot de passe personnel.`,
    })
  }
  catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      event: 'admin_password_reset_email_failed',
      userId,
      error: error instanceof Error ? error.message : String(error),
    }))
  }

  await writeAuditLog(event, context, {
    action: 'USER_PASSWORD_RESET',
    entityType: 'User',
    entityId: userId,
    metadata: { emailDelivered },
  })

  return success({
    reset: true,
    credentials: emailDelivered ? null : {
      email: user.email,
      temporaryPassword,
    },
  })
})
