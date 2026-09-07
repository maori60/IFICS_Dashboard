import { getRouterParam, readBody } from 'h3'
import { requirePermission, revokeUserSessions } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { httpError, prismaErrorCode, requireRouterId, success } from '../../utils/api'
import {
  optionalDate,
  optionalString,
  requiredEmail,
  requiredString,
  safeObject,
} from '../../utils/validation'
import { writeAuditLog } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.USER_MANAGE)
  const userId = requireRouterId(getRouterParam(event, 'id'), 'Utilisateur')
  const body = safeObject(await readBody(event))

  const existing = await prisma.user.findFirst({
    where: { id: userId, associationId: context.associationId },
    select: {
      id: true,
      roleId: true,
      clientId: true,
      status: true,
      intervenorProfile: { select: { id: true } },
    },
  })

  if (!existing) {
    httpError(404, 'Utilisateur introuvable.', 'USER_NOT_FOUND')
  }

  const firstName = requiredString(body.firstName, 'Prénom', { max: 100 })
  const lastName = requiredString(body.lastName, 'Nom', { max: 100 })
  const email = requiredEmail(body.email)
  const phone = optionalString(body.phone, 'Téléphone', { max: 30 })
  const roleCode = requiredString(body.roleCode, 'Rôle', { max: 50 }).toUpperCase()
  const status = requiredString(body.status, 'Statut', { max: 20 }).toUpperCase()
  const clientId = optionalString(body.clientId, 'Client', { max: 191 })
  const intervenorId = optionalString(body.intervenorId, 'Intervenant', { max: 191 })
  const accessExpiresAt = optionalDate(body.accessExpiresAt, 'Expiration de l’accès')

  if (!['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(status)) {
    httpError(400, 'Statut utilisateur invalide.', 'INVALID_USER_STATUS')
  }

  const role = await prisma.role.findFirst({
    where: { associationId: context.associationId, code: roleCode },
    select: { id: true, code: true, name: true },
  })

  if (!role) httpError(400, 'Rôle inconnu.', 'INVALID_ROLE')
  if (role.code === 'CLIENT' && !clientId) {
    httpError(400, 'Un compte client doit être rattaché à un client.', 'CLIENT_LINK_REQUIRED')
  }
  if (role.code === 'INTERVENOR' && !intervenorId) {
    httpError(400, 'Un compte intervenant doit être rattaché à un intervenant.', 'INTERVENOR_LINK_REQUIRED')
  }

  if (userId === context.userId && (status !== 'ACTIVE' || role.id !== existing.roleId)) {
    httpError(400, 'Vous ne pouvez pas désactiver votre propre compte ou changer votre propre rôle.', 'SELF_LOCKOUT_PREVENTED')
  }

  if (clientId) {
    const client = await prisma.client.findFirst({
      where: { id: clientId, associationId: context.associationId, archivedAt: null },
      select: { id: true },
    })
    if (!client) httpError(404, 'Client introuvable.', 'CLIENT_NOT_FOUND')
  }

  if (intervenorId) {
    const intervenor = await prisma.intervenor.findFirst({
      where: { id: intervenorId, associationId: context.associationId, archivedAt: null },
      select: { id: true, userId: true },
    })
    if (!intervenor) httpError(404, 'Intervenant introuvable.', 'INTERVENOR_NOT_FOUND')
    if (intervenor.userId && intervenor.userId !== userId) {
      httpError(409, 'Cet intervenant possède déjà un autre compte.', 'INTERVENOR_ALREADY_LINKED')
    }
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (existing.intervenorProfile?.id && existing.intervenorProfile.id !== intervenorId) {
        await tx.intervenor.update({
          where: { id: existing.intervenorProfile.id },
          data: { userId: null },
        })
      }

      if (role.code === 'INTERVENOR' && intervenorId) {
        await tx.intervenor.update({
          where: { id: intervenorId },
          data: { userId },
        })
      }

      return tx.user.update({
        where: { id: userId },
        data: {
          firstName,
          lastName,
          email,
          phone,
          roleId: role.id,
          clientId: role.code === 'CLIENT' ? clientId : null,
          status: status as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED',
          accessExpiresAt,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          status: true,
          accessExpiresAt: true,
          role: { select: { code: true, name: true } },
          client: { select: { id: true, name: true } },
          intervenorProfile: { select: { id: true, firstName: true, lastName: true } },
        },
      })
    })

    const securityRelevantChange = role.id !== existing.roleId
      || status !== existing.status
      || clientId !== existing.clientId
      || intervenorId !== existing.intervenorProfile?.id

    if (securityRelevantChange) {
      await revokeUserSessions(userId, userId === context.userId ? context.sessionId : undefined)
    }

    await writeAuditLog(event, context, {
      action: 'USER_UPDATED',
      entityType: 'User',
      entityId: userId,
      metadata: { roleCode: role.code, status, clientId, intervenorId, accessExpiresAt },
    })

    return success(updated)
  }
  catch (error) {
    if (prismaErrorCode(error) === 'P2002') {
      httpError(409, 'Cet email est déjà utilisé.', 'EMAIL_ALREADY_USED')
    }
    throw error
  }
})
