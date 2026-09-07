import { readBody } from 'h3'
import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { httpError, prismaErrorCode, success } from '../../utils/api'
import { optionalString, requiredString, safeObject, stringArray } from '../../utils/validation'
import { writeAuditLog } from '../../utils/audit'

const VALID_PERMISSIONS = new Set(Object.values(PERMISSIONS))

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.USER_MANAGE)
  const body = safeObject(await readBody(event))
  const permissions = stringArray(body.permissions, 'Permissions').filter(permission => VALID_PERMISSIONS.has(permission as typeof PERMISSIONS[keyof typeof PERMISSIONS]))
  if (permissions.length !== (body.permissions as unknown[]).length) httpError(400, 'Une permission est inconnue.', 'UNKNOWN_PERMISSION')
  try {
    const role = await prisma.role.create({ data: { associationId: context.associationId, name: requiredString(body.name, 'Nom', { max: 100 }), code: requiredString(body.code, 'Code', { max: 50 }).toUpperCase().replace(/[^A-Z0-9_]/g, '_'), description: optionalString(body.description, 'Description'), permissions, isSystemRole: false } })
    await writeAuditLog(event, context, { action: 'ROLE_CREATED', entityType: 'Role', entityId: role.id, metadata: { code: role.code, permissions } })
    return success(role)
  }
  catch (error) {
    if (prismaErrorCode(error) === 'P2002') httpError(409, 'Ce rôle existe déjà.', 'ROLE_DUPLICATE')
    throw error
  }
})
