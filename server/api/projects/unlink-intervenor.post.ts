import { readBody } from 'h3'
import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { httpError, success } from '../../utils/api'
import { requiredString, safeObject } from '../../utils/validation'
import { writeAuditLog } from '../../utils/audit'
import { notifyUser } from '../../utils/notifications'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.PROJECT_ASSIGN)
  const body = safeObject(await readBody(event))
  const projectId = requiredString(body.projectId, 'Projet', { max: 191 })
  const intervenorId = requiredString(body.intervenorId, 'Intervenant', { max: 191 })

  const link = await prisma.projectIntervenor.findFirst({
    where: {
      projectId,
      intervenorId,
      project: { associationId: context.associationId, archivedAt: null },
      intervenor: { associationId: context.associationId },
    },
    select: {
      id: true,
      project: { select: { title: true } },
      intervenor: { select: { userId: true } },
    },
  })
  if (!link) httpError(404, 'Affectation introuvable.', 'ASSIGNMENT_NOT_FOUND')

  await prisma.projectIntervenor.delete({ where: { id: link.id } })

  if (link.intervenor.userId) {
    await notifyUser(link.intervenor.userId, {
      type: 'WARNING',
      title: 'Mission retirée',
      message: `Votre affectation au projet « ${link.project.title} » a été retirée.`,
      email: true,
    })
  }

  await writeAuditLog(event, context, {
    action: 'PROJECT_INTERVENOR_UNASSIGNED',
    entityType: 'ProjectIntervenor',
    entityId: link.id,
    metadata: { projectId, intervenorId },
  })

  return success({ deleted: true })
})
