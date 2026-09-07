import { readBody } from 'h3'
import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { httpError, success } from '../../utils/api'
import { requiredString, safeObject } from '../../utils/validation'
import { writeAuditLog } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.PROJECT_WRITE)
  const body = safeObject(await readBody(event))
  const projectId = requiredString(body.id, 'Projet', { max: 191 })

  const existing = await prisma.project.findFirst({
    where: { id: projectId, associationId: context.associationId, archivedAt: null },
    select: { id: true, title: true },
  })
  if (!existing) httpError(404, 'Projet introuvable.', 'PROJECT_NOT_FOUND')

  const project = await prisma.project.update({
    where: { id: projectId },
    data: { archivedAt: new Date() },
    select: { id: true, title: true, archivedAt: true },
  })

  await writeAuditLog(event, context, {
    action: 'PROJECT_ARCHIVED',
    entityType: 'Project',
    entityId: projectId,
    metadata: { title: existing.title },
  })

  return success(project)
})
