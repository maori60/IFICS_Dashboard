import { getRouterParam } from 'h3'
import { requirePermission } from '../../../utils/auth'
import { PERMISSIONS } from '../../../utils/constants'
import { prisma } from '../../../utils/prisma'
import { createOpaqueToken, hashToken } from '../../../utils/security'
import { sendMail } from '../../../utils/mail'
import { httpError, requireRouterId, success } from '../../../utils/api'
import { writeAuditLog } from '../../../utils/audit'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.USER_MANAGE)
  const userId = requireRouterId(getRouterParam(event, 'id'), 'Utilisateur')
  const user = await prisma.user.findFirst({ where: { id: userId, associationId: context.associationId }, select: { id: true, firstName: true, email: true, status: true } })
  if (!user) httpError(404, 'Utilisateur introuvable.', 'USER_NOT_FOUND')
  if (user.status === 'ACTIVE') httpError(409, 'Ce compte est déjà actif.', 'USER_ALREADY_ACTIVE')
  const token = createOpaqueToken(32)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.passwordResetToken.create({ data: { userId, tokenHash: hashToken(token), expiresAt } }),
  ])
  const baseUrl = (process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
  const activationUrl = `${baseUrl}/activate?token=${encodeURIComponent(token)}`
  let emailDelivered = false
  try { emailDelivered = await sendMail({ to: user.email, subject: 'Nouvelle invitation IFICS', text: `Bonjour ${user.firstName},\n\nVotre nouveau lien d’activation IFICS est valable 7 jours :\n${activationUrl}` }) }
  catch (error) { console.error(JSON.stringify({ level: 'error', event: 'invitation_email_failed', userId, error: error instanceof Error ? error.message : String(error) })) }
  await writeAuditLog(event, context, { action: 'USER_REINVITED', entityType: 'User', entityId: userId, metadata: { expiresAt, emailDelivered } })
  return success({ expiresAt, emailDelivered, activationUrl: emailDelivered ? null : activationUrl })
})
