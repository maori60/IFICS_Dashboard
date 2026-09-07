import { getRouterParam } from 'h3'
import { requirePermission } from '../../../../utils/auth'
import { PERMISSIONS } from '../../../../utils/constants'
import { prisma } from '../../../../utils/prisma'
import { createOpaqueToken, hashToken } from '../../../../utils/security'
import { requireRouterId, success, httpError } from '../../../../utils/api'
import { sendMail } from '../../../../utils/mail'
import { writeAuditLog } from '../../../../utils/audit'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.SECURITY_MFA_RESET)
  if (!context.mfaVerified) httpError(403, 'Validation MFA administrateur requise.', 'ADMIN_MFA_REQUIRED')
  const id = requireRouterId(getRouterParam(event, 'id'), 'Demande MFA')

  const request = await prisma.mfaResetRequest.findFirst({
    where: { id, associationId: context.associationId, status: 'PENDING' }, select: { id: true, userId: true },
  })
  if (!request) httpError(404, 'Demande MFA en attente introuvable.', 'MFA_RESET_NOT_FOUND')
  const user = await prisma.user.findFirst({
    where: { id: request.userId, associationId: context.associationId, status: 'ACTIVE', mfaEnabled: true },
    select: { id: true, email: true, firstName: true },
  })
  if (!user) httpError(409, 'Le compte n’est plus éligible à cette récupération.', 'MFA_RESET_NOT_ELIGIBLE')

  const rawToken = createOpaqueToken(32)
  const expiresAt = new Date(Date.now() + 45 * 60 * 1000)
  await prisma.mfaResetRequest.update({
    where: { id }, data: { status: 'APPROVED', tokenHash: hashToken(rawToken), approvedByUserId: context.userId, approvedAt: new Date(), expiresAt },
  })

  const baseUrl = (process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
  const recoveryUrl = `${baseUrl}/mfa-recovery?token=${encodeURIComponent(rawToken)}`
  let delivered = false
  try {
    delivered = await sendMail({
      to: user.email,
      subject: 'Récupération MFA IFICS approuvée',
      text: `Bonjour ${user.firstName},\n\nVotre récupération MFA a été approuvée après vérification. Ce lien est à usage unique et expire dans 45 minutes :\n${recoveryUrl}\n\nAprès utilisation, toutes vos sessions seront révoquées et vous devrez configurer un nouveau second facteur.`,
    })
  }
  catch (error) {
    console.error(JSON.stringify({ level: 'error', event: 'mfa_recovery_mail_failed', userId: user.id, error: error instanceof Error ? error.message : String(error) }))
  }

  await writeAuditLog(event, context, {
    action: 'MFA_RESET_APPROVED', entityType: 'MfaResetRequest', entityId: id,
    metadata: { targetUserId: user.id, delivered, expiresAt },
  })
  return success({ approved: true, delivered, expiresAt, recoveryUrl: delivered ? null : recoveryUrl })
})
