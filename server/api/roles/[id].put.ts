import { getRouterParam, readBody } from 'h3'
import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { httpError, requireRouterId, success } from '../../utils/api'
import { optionalString, requiredString, safeObject, stringArray } from '../../utils/validation'
import { writeAuditLog } from '../../utils/audit'

const VALID_PERMISSIONS = new Set(Object.values(PERMISSIONS))

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.USER_MANAGE)
  const id = requireRouterId(getRouterParam(event, 'id'), 'Rôle')
  const body = safeObject(await readBody(event))
  const existing = await prisma.role.findFirst({ where: { id, associationId: context.associationId }, select: { id: true, isSystemRole: true } })
  if (!existing) httpError(404, 'Rôle introuvable.', 'ROLE_NOT_FOUND')
  if (existing.isSystemRole) httpError(409, 'Les rôles système sont synchronisés par le code et ne sont pas modifiables ici.', 'SYSTEM_ROLE_LOCKED')
  const permissions = stringArray(body.permissions, 'Permissions').filter(permission => VALID_PERMISSIONS.has(permission as typeof PERMISSIONS[keyof typeof PERMISSIONS]))
  if (permissions.length !== (body.permissions as unknown[]).length) httpError(400, 'Une permission est inconnue.', 'UNKNOWN_PERMISSION')
  const role = await prisma.role.update({ where: { id }, data: { name: requiredString(body.name, 'Nom', { max: 100 }), description: optionalString(body.description, 'Description'), permissions } })
  await writeAuditLog(event, context, { action: 'ROLE_UPDATED', entityType: 'Role', entityId: id, metadata: { permissions } })
  return success(role)
})
