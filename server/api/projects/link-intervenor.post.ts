import { readBody } from 'h3'
import { requirePermission } from '../../utils/auth'
import { PERMISSIONS } from '../../utils/constants'
import { prisma } from '../../utils/prisma'
import { httpError, prismaErrorCode, success } from '../../utils/api'
import { requiredString, safeObject } from '../../utils/validation'
import { writeAuditLog } from '../../utils/audit'
import { notifyUser } from '../../utils/notifications'

export default defineEventHandler(async (event) => {
  const context = await requirePermission(event, PERMISSIONS.PROJECT_ASSIGN)
  const body = safeObject(await readBody(event))
  const projectId = requiredString(body.projectId, 'Projet', { max: 191 })
  const intervenorId = requiredString(body.intervenorId, 'Intervenant', { max: 191 })

  const [project, intervenor] = await Promise.all([
    prisma.project.findFirst({
      where: { id: projectId, associationId: context.associationId, archivedAt: null },
      select: { id: true, title: true },
    }),
    prisma.intervenor.findFirst({
      where: { id: intervenorId, associationId: context.associationId, archivedAt: null, status: 'ACTIVE' },
      select: { id: true, firstName: true, lastName: true, userId: true },
    }),
  ])

  if (!project) httpError(404, 'Projet introuvable.', 'PROJECT_NOT_FOUND')
  if (!intervenor) httpError(404, 'Intervenant introuvable.', 'INTERVENOR_NOT_FOUND')

  try {
    const link = await prisma.projectIntervenor.create({
      data: {
        projectId,
        intervenorId,
        assignmentStatus: 'PENDING',
        invitedAt: new Date(),
      },
      select: {
        id: true,
        assignmentStatus: true,
        project: { select: { id: true, title: true, status: true } },
        intervenor: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    })

    if (intervenor.userId) {
      await notifyUser(intervenor.userId, {
        type: 'ACTION',
        title: 'Nouvelle mission proposée',
        message: `Vous avez été proposé sur le projet « ${project.title} ».`,
        href: `/projects/${project.id}`,
        email: true,
      })
    }

    await writeAuditLog(event, context, {
      action: 'PROJECT_INTERVENOR_ASSIGNED',
      entityType: 'ProjectIntervenor',
      entityId: link.id,
      metadata: { projectId, intervenorId },
    })

    return success(link)
  }
  catch (error) {
    if (prismaErrorCode(error) === 'P2002') {
      httpError(409, 'Cet intervenant est déjà lié à ce projet.', 'ASSIGNMENT_ALREADY_EXISTS')
    }
    throw error
  }
})
