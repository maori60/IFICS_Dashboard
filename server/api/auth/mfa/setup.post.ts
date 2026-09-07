import QRCode from 'qrcode'
import { requireAuth } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import {
  buildTotpUri,
  encryptSecret,
  generateTotpSecret,
} from '../../../utils/security'
import { httpError, success } from '../../../utils/api'
import { writeAuditLog } from '../../../utils/audit'

export default defineEventHandler(async (event) => {
  const context = await requireAuth(event, { skipMfa: true })

  if (context.mfaEnabled) {
    httpError(409, 'Le MFA est déjà activé sur ce compte.', 'MFA_ALREADY_ENABLED')
  }

  const secret = generateTotpSecret()
  const encrypted = encryptSecret(secret)
  const uri = buildTotpUri(context.email, secret)
  const qrDataUrl = await QRCode.toDataURL(uri, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 280,
  })

  await prisma.user.update({
    where: { id: context.userId },
    data: {
      mfaEnabled: false,
      mfaSecretCiphertext: encrypted.ciphertext,
      mfaSecretIv: encrypted.iv,
      mfaSecretTag: encrypted.tag,
      mfaRecoveryCodesHash: [],
      mfaConfirmedAt: null,
    },
  })

  await writeAuditLog(event, context, {
    action: 'MFA_ENROLLMENT_STARTED',
  })

  return success({
    secret,
    uri,
    qrDataUrl,
  })
})
