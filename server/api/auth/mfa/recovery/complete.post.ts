import { readBody } from 'h3'
import { prisma } from '../../../../utils/prisma'
import { hashToken } from '../../../../utils/security'
import { requiredString, safeObject } from '../../../../utils/validation'
import { success, httpError } from '../../../../utils/api'
import { revokeUserSessions } from '../../../../utils/auth'
import { sendMail } from '../../../../utils/mail'
import { writeAuditLog } from '../../../../utils/audit'

export default defineEventHandler(async (event) => {
  const body = safeObject(await readBody(event))
  const token = requiredString(body.token, 'Jeton MFA', { min: 20, max: 200 })
  const now = new Date()
  const request = await prisma.mfaResetRequest.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, associationId: true, userId: true, status: true, expiresAt: true },
  })
  if (!request || request.status !== 'APPROVED' || !request.expiresAt || request.expiresAt <= now) {
    if (request?.status === 'APPROVED') {
      await prisma.mfaResetRequest.update({ where: { id: request.id }, data: { status: 'EXPIRED' } }).catch(() => undefined)
    }
    httpError(400, 'Le lien de récupération MFA est invalide ou expiré.', 'INVALID_MFA_RECOVERY_TOKEN')
  }
  const user = await prisma.user.findUnique({ where: { id: request.userId }, select: { id: true, email: true, firstName: true } })
  if (!user) httpError(400, 'Le compte associé n’existe plus.', 'MFA_USER_NOT_FOUND')

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { mfaEnabled: false, mfaSecretCiphertext: null, mfaSecretIv: null, mfaSecretTag: null, mfaConfirmedAt: null, recoveryCodeHashes: [] },
    }),
    prisma.mfaResetRequest.update({ where: { id: request.id }, data: { status: 'USED', usedAt: now } }),
    prisma.mfaResetRequest.updateMany({
      where: { userId: user.id, id: { not: request.id }, status: { in: ['PENDING', 'APPROVED'] } },
      data: { status: 'REJECTED', rejectedAt: now },
    }),
  ])
  await revokeUserSessions(user.id)
  await writeAuditLog(event, null, {
    associationId: request.associationId, userId: user.id, action: 'MFA_RESET_COMPLETED',
    entityType: 'MfaResetRequest', entityId: request.id,
  })
  try {
    await sendMail({
      to: user.email, subject: 'Sécurité IFICS — MFA réinitialisé',
      text: `Bonjour ${user.firstName},\n\nVotre ancien second facteur MFA et vos codes de récupération ont été révoqués. Toutes vos sessions ont été fermées. Reconnectez-vous et configurez immédiatement un nouveau MFA.`,
    })
  }
  catch (error) {
    console.error(JSON.stringify({ level: 'error', event: 'mfa_reset_confirmation_mail_failed', userId: user.id, error: error instanceof Error ? error.message : String(error) }))
  }
  return success({ reset: true })
})
