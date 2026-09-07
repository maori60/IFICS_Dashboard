import { readBody } from 'h3'
import { prisma } from '../../../utils/prisma'
import { createOpaqueToken, hashToken } from '../../../utils/security'
import { sendMail } from '../../../utils/mail'
import { success } from '../../../utils/api'
import { requiredEmail, safeObject } from '../../../utils/validation'
import { writeAuditLog } from '../../../utils/audit'

export default defineEventHandler(async (event) => {
  const body = safeObject(await readBody(event))
  const email = requiredEmail(body.email)
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      associationId: true,
      firstName: true,
      status: true,
    },
  })

  if (user && user.status === 'ACTIVE') {
    const token = createOpaqueToken(32)

    await prisma.$transaction([
      prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      }),
    ])

    const baseUrl = (process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
    const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`

    try {
      await sendMail({
        to: email,
        subject: 'Réinitialisation de votre mot de passe IFICS',
        text: `Bonjour ${user.firstName},\n\nUn lien de réinitialisation a été demandé pour votre compte IFICS. Il expire dans une heure.\n\n${resetUrl}\n\nSi vous n’êtes pas à l’origine de cette demande, ignorez ce message.`,
      })
    }
    catch (error) {
      console.error(JSON.stringify({
        level: 'error',
        event: 'password_reset_email_failed',
        userId: user.id,
        error: error instanceof Error ? error.message : String(error),
      }))
    }

    await writeAuditLog(event, null, {
      associationId: user.associationId,
      userId: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
    })
  }

  // Always return the same response to prevent account enumeration.
  return success({
    accepted: true,
    message: 'Si ce compte existe, les instructions de réinitialisation seront envoyées.',
  })
})
