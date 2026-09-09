import { readBody } from 'h3'
import { requirePermission } from '../../../utils/auth'
import { PERMISSIONS } from '../../../utils/constants'
import { prisma } from '../../../utils/prisma'
import { httpError, success } from '../../../utils/api'
import { optionalString, requiredString, safeObject } from '../../../utils/validation'
import { writeAuditLog } from '../../../utils/audit'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.HR_WRITE)
  const body = safeObject(await readBody(event))
  const code = requiredString(body.code, 'Code du poste', { max: 60 }).toUpperCase().replace(/[^A-Z0-9_-]/g, '_')
  const title = requiredString(body.title, 'Intitulé du poste', { max: 180 })
  const departmentId = optionalString(body.departmentId, 'Département', { max: 191 })
  const description = optionalString(body.description, 'Description')

  if (departmentId) {
    const department = await prisma.department.findFirst({ where: { id: departmentId, associationId: context.associationId }, select: { id: true } })
    if (!department) httpError(400, 'Département invalide.', 'INVALID_DEPARTMENT')
  }

  const existing = await prisma.jobPosition.findUnique({
    where: { associationId_code: { associationId: context.associationId, code } },
    select: { id: true },
  })
  if (existing) httpError(409, 'Ce code de poste existe déjà.', 'POSITION_CODE_EXISTS')

  const position = await prisma.jobPosition.create({
    data: { associationId: context.associationId, code, title, departmentId, description },
  })

  await writeAuditLog(event, context, {
    action: 'HR_POSITION_CREATED',
    entityType: 'JobPosition',
    entityId: position.id,
    metadata: { code },
  })

  return success(position)
})