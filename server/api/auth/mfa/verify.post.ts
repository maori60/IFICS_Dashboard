import { readBody } from 'h3'
import { markSessionMfaVerified, requireAuth } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import {
  decryptSecret,
  hashRecoveryCode,
  verifyTotp,
} from '../../../utils/security'
import { httpError, success } from '../../../utils/api'
import { requiredString, safeObject } from '../../../utils/validation'
import { writeAuditLog } from '../../../utils/audit'

export default defineEventHandler(async (event) => {
  const context = await requireAuth(event, { skipMfa: true })
  const body = safeObject(await readBody(event))
  const code = requiredString(body.code, 'Code MFA', { min: 6, max: 32 })

  const user = await prisma.user.findUnique({
    where: { id: context.userId },
    select: {
      mfaEnabled: true,
      mfaSecretCiphertext: true,
      mfaSecretIv: true,
      mfaSecretTag: true,
      mfaRecoveryCodesHash: true,
    },
  })

  if (!user || !user.mfaEnabled) {
    httpError(409, 'Le MFA n’est pas activé pour ce compte.', 'MFA_NOT_ENABLED')
  }

  let valid = false
  let recoveryCodeIndex = -1

  if (/^\d{6}$/.test(code)
    && user.mfaSecretCiphertext
    && user.mfaSecretIv
    && user.mfaSecretTag) {
    const secret = decryptSecret({
      ciphertext: user.mfaSecretCiphertext,
      iv: user.mfaSecretIv,
      tag: user.mfaSecretTag,
    })
    valid = verifyTotp(secret, code)
  }

  if (!valid) {
    const recoveryHash = hashRecoveryCode(code)
    recoveryCodeIndex = user.mfaRecoveryCodesHash.indexOf(recoveryHash)
    valid = recoveryCodeIndex !== -1
  }

  if (!valid) {
    await writeAuditLog(event, context, {
      action: 'MFA_CHALLENGE',
      outcome: 'FAILURE',
    })
    httpError(401, 'Code MFA ou code de récupération invalide.', 'INVALID_MFA_CODE')
  }

  if (recoveryCodeIndex !== -1) {
    const remainingCodes = user.mfaRecoveryCodesHash.filter((_hash, index) => index !== recoveryCodeIndex)
    await prisma.user.update({
      where: { id: context.userId },
      data: { mfaRecoveryCodesHash: remainingCodes },
    })
  }

  await markSessionMfaVerified(context.sessionId)
  await prisma.user.update({
    where: { id: context.userId },
    data: { lastLoginAt: new Date() },
  })

  await writeAuditLog(event, context, {
    action: 'MFA_CHALLENGE',
    metadata: { recoveryCodeUsed: recoveryCodeIndex !== -1 },
  })

  return success({ verified: true })
})
