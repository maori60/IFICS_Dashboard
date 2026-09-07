import { getRouterParam, readBody } from 'h3'
import { requireAuth } from '../../../../utils/auth'
import { prisma } from '../../../../utils/prisma'
import { httpError, requireRouterId, success } from '../../../../utils/api'
import { optionalString, requiredEnum, safeObject } from '../../../../utils/validation'
import { writeAuditLog } from '../../../../utils/audit'
import { notifyRoles } from '../../../../utils/notifications'

const RESPONSES = ['ACCEPTED', 'REFUSED'] as const

export default defineEventHandler(async (event) => {
  const context = await requireAuth(event)
  const projectId = requireRouterId(getRouterParam(event, 'id'), 'Projet')

  if (context.roleCode !== 'INTERVENOR' || !context.intervenorId) {
    httpError(403, 'Cette action est réservée aux intervenants.', 'INTERVENOR_ONLY')
  }

  const body = safeObject(await readBody(event))
  const assignmentStatus = requiredEnum(body.assignmentStatus, RESPONSES, 'Réponse')
  const responseComment = optionalString(body.responseComment, 'Commentaire', { max: 2000 })

  const link = await prisma.projectIntervenor.findFirst({
    where: {
      projectId,
      intervenorId: context.intervenorId,
      project: { associationId: context.associationId, archivedAt: null },
    },
    select: { id: true, assignmentStatus: true, project: { select: { title: true } } },
  })
  if (!link) httpError(404, 'Affectation introuvable.', 'ASSIGNMENT_NOT_FOUND')
  if (link.assignmentStatus !== 'PENDING') {
    httpError(409, 'Cette proposition a déjà reçu une réponse.', 'ASSIGNMENT_ALREADY_RESPONDED')
  }

  const updated = await prisma.projectIntervenor.update({
    where: { id: link.id },
    data: {
      assignmentStatus,
      responseComment,
      respondedAt: new Date(),
    },
  })

  await notifyRoles(context.associationId, ['ADMIN', 'MANAGER'], {
    type: assignmentStatus === 'ACCEPTED' ? 'SUCCESS' : 'WARNING',
    title: assignmentStatus === 'ACCEPTED' ? 'Mission acceptée' : 'Mission refusée',
    message: `${context.firstName} ${context.lastName} a ${assignmentStatus === 'ACCEPTED' ? 'accepté' : 'refusé'} le projet « ${link.project.title} ».`,
    href: `/projects/${projectId}`,
  })

  await writeAuditLog(event, context, {
    action: 'PROJECT_ASSIGNMENT_RESPONDED',
    entityType: 'ProjectIntervenor',
    entityId: link.id,
    metadata: { projectId, assignmentStatus },
  })

  return success(updated)
})
