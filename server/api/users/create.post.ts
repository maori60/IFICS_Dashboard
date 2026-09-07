import { readBody } from 'h3'
import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { createOpaqueToken, hashPassword, hashToken } from '../../utils/security'
import { sendMail } from '../../utils/mail'
import { httpError, prismaErrorCode, success } from '../../utils/api'
import { optionalDate, optionalString, requiredEmail, requiredString, safeObject } from '../../utils/validation'
import { writeAuditLog } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.USER_MANAGE)
  const body = safeObject(await readBody(event))
  const firstName = requiredString(body.firstName, 'Prénom', { max: 100 })
  const lastName = requiredString(body.lastName, 'Nom', { max: 100 })
  const email = requiredEmail(body.email)
  const phone = optionalString(body.phone, 'Téléphone', { max: 30 })
  const roleCode = requiredString(body.roleCode, 'Rôle', { max: 50 }).toUpperCase()
  const clientId = optionalString(body.clientId, 'Client', { max: 191 })
  const intervenorId = optionalString(body.intervenorId, 'Intervenant', { max: 191 })
  const accessExpiresAt = optionalDate(body.accessExpiresAt, 'Expiration de l’accès')
  const role = await prisma.role.findFirst({ where: { associationId: context.associationId, code: roleCode }, select: { id: true, code: true, name: true } })
  if (!role) httpError(400, 'Rôle inconnu.', 'INVALID_ROLE')
  if (role.code === 'CLIENT' && !clientId) httpError(400, 'Un compte client doit être rattaché à un client.', 'CLIENT_LINK_REQUIRED')
  if (role.code === 'INTERVENOR' && !intervenorId) httpError(400, 'Un compte intervenant doit être rattaché à un intervenant.', 'INTERVENOR_LINK_REQUIRED')

  if (clientId) {
    const client = await prisma.client.findFirst({ where: { id: clientId, associationId: context.associationId, archivedAt: null }, select: { id: true } })
    if (!client) httpError(404, 'Client introuvable.', 'CLIENT_NOT_FOUND')
  }
  if (intervenorId) {
    const intervenor = await prisma.intervenor.findFirst({ where: { id: intervenorId, associationId: context.associationId, archivedAt: null }, select: { id: true, userId: true } })
    if (!intervenor) httpError(404, 'Intervenant introuvable.', 'INTERVENOR_NOT_FOUND')
    if (intervenor.userId) httpError(409, 'Cet intervenant possède déjà un compte.', 'INTERVENOR_ALREADY_LINKED')
  }

  const rawToken = createOpaqueToken(32)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const unusablePassword = await hashPassword(`If!${createOpaqueToken(24)}aA1`)

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          associationId: context.associationId, roleId: role.id, clientId: role.code === 'CLIENT' ? clientId : null,
          firstName, lastName, email, passwordHash: unusablePassword, phone, status: 'INACTIVE', accessExpiresAt,
        },
        select: { id: true, firstName: true, lastName: true, email: true, status: true, accessExpiresAt: true, role: { select: { code: true, name: true } } },
      })
      if (role.code === 'INTERVENOR' && intervenorId) await tx.intervenor.update({ where: { id: intervenorId }, data: { userId: created.id } })
      await tx.passwordResetToken.create({ data: { userId: created.id, tokenHash: hashToken(rawToken), expiresAt } })
      return created
    })

    const baseUrl = (process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
    const activationUrl = `${baseUrl}/activate?token=${encodeURIComponent(rawToken)}`
    let emailDelivered = false
    try {
      emailDelivered = await sendMail({ to: email, subject: 'Invitation IFICS', text: `Bonjour ${firstName},\n\nVotre accès IFICS est prêt. Créez votre mot de passe via ce lien à usage unique, valable 7 jours :\n${activationUrl}\n\nLe MFA sera demandé si votre rôle l’exige.` })
    }
    catch (mailError) {
      console.error(JSON.stringify({ level: 'error', event: 'invitation_email_failed', userId: user.id, error: mailError instanceof Error ? mailError.message : String(mailError) }))
    }
    await writeAuditLog(event, context, { action: 'USER_INVITED', entityType: 'User', entityId: user.id, metadata: { roleCode: role.code, clientId, intervenorId, expiresAt, emailDelivered } })
    return success({ user, invitation: { expiresAt, emailDelivered, activationUrl: emailDelivered ? null : activationUrl } })
  }
  catch (error) {
    if (prismaErrorCode(error) === 'P2002') httpError(409, 'Un utilisateur avec cet email existe déjà.', 'EMAIL_ALREADY_USED')
    throw error
  }
})
