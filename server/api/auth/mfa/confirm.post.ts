import { readBody } from 'h3'
import { requireAuth, markSessionMfaVerified } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import {
  decryptSecret,
  generateRecoveryCodes,
  hashRecoveryCode,
  verifyTotp,
} from '../../../utils/security'
import { httpError, success } from '../../../utils/api'
import { requiredString, safeObject } from '../../../utils/validation'
import { writeAuditLog } from '../../../utils/audit'

export default defineEventHandler(async (event) => {
  const context = await requireAuth(event, { skipMfa: true })
  const body = safeObject(await readBody(event))
  const code = requiredString(body.code, 'Code MFA', { min: 6, max: 6 })

  const user = await prisma.user.findUnique({
    where: { id: context.userId },
    select: {
      mfaEnabled: true,
      mfaSecretCiphertext: true,
      mfaSecretIv: true,
      mfaSecretTag: true,
    },
  })

  if (!user) {
    httpError(404, 'Utilisateur introuvable.', 'USER_NOT_FOUND')
  }

  if (user.mfaEnabled) {
    httpError(409, 'Le MFA est déjà activé.', 'MFA_ALREADY_ENABLED')
  }

  if (!user.mfaSecretCiphertext || !user.mfaSecretIv || !user.mfaSecretTag) {
    httpError(409, 'Aucun enrôlement MFA en cours.', 'MFA_SETUP_NOT_STARTED')
  }

  const secret = decryptSecret({
    ciphertext: user.mfaSecretCiphertext,
    iv: user.mfaSecretIv,
    tag: user.mfaSecretTag,
  })

  if (!verifyTotp(secret, code)) {
    await writeAuditLog(event, context, {
      action: 'MFA_ENROLLMENT_CONFIRMED',
      outcome: 'FAILURE',
    })
    httpError(400, 'Code MFA invalide.', 'INVALID_MFA_CODE')
  }

  const recoveryCodes = generateRecoveryCodes()

  await prisma.user.update({
    where: { id: context.userId },
    data: {
      mfaEnabled: true,
      mfaConfirmedAt: new Date(),
      mfaRecoveryCodesHash: recoveryCodes.map(hashRecoveryCode),
      lastLoginAt: new Date(),
    },
  })

  await markSessionMfaVerified(context.sessionId)
  await writeAuditLog(event, context, { action: 'MFA_ENABLED' })

  return success({
    enabled: true,
    recoveryCodes,
  })
})
