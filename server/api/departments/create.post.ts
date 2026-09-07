import { readBody } from 'h3'
import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { success } from '../../utils/api'
import { optionalString, requiredString, safeObject } from '../../utils/validation'
import { writeAuditLog } from '../../utils/audit'
export default defineEventHandler(async (event) => { const context = await requirePermission(event, PERMISSIONS.HR_WRITE); const body = safeObject(await readBody(event)); const department = await prisma.department.create({ data: { associationId: context.associationId, name: requiredString(body.name, 'Nom', { max: 150 }), code: requiredString(body.code, 'Code', { max: 50 }).toUpperCase().replace(/[^A-Z0-9_]/g, '_'), description: optionalString(body.description, 'Description') } }); await writeAuditLog(event, context, { action: 'DEPARTMENT_CREATED', entityType: 'Department', entityId: department.id }); return success(department) })
