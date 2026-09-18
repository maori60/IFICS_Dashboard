import { hasPermission, type AuthContext } from './auth'
import { httpError } from './api'
import { PERMISSIONS } from './constants'
import { prisma } from './prisma'

export async function requireCraAssignmentForCreation(
  context: AuthContext,
  projectId: string,
  intervenorId: string,
) {
  const canManage = hasPermission(context, PERMISSIONS.CRA_MANAGE)
  const canWriteOwn = hasPermission(context, PERMISSIONS.CRA_WRITE_OWN)
    && context.intervenorId === intervenorId

  if (!canManage && !canWriteOwn) {
    httpError(403, 'Création de ce CRA interdite.', 'CRA_FORBIDDEN')
  }

  const assignment = await prisma.projectIntervenor.findFirst({
    where: {
      projectId,
      intervenorId,
      assignmentStatus: 'ACCEPTED',
      project: {
        associationId: context.associationId,
        archivedAt: null,
        status: { not: 'CANCELLED' },
      },
      intervenor: {
        associationId: context.associationId,
        archivedAt: null,
        status: 'ACTIVE',
      },
    },
    select: {
      id: true,
      projectId: true,
      intervenorId: true,
      project: {
        select: {
          classification: true,
          startDate: true,
          endDate: true,
        },
      },
    },
  })

  if (!assignment) {
    httpError(
      404,
      'Mission acceptée introuvable pour cet intervenant.',
      'CRA_ASSIGNMENT_NOT_FOUND',
    )
  }

  const confidential = ['CONFIDENTIAL', 'RESTRICTED']
    .includes(assignment.project.classification)

  if (
    confidential
    && !hasPermission(context, PERMISSIONS.PROJECT_CONFIDENTIAL_READ)
  ) {
    httpError(
      403,
      'Autorisation nécessaire pour ce projet confidentiel.',
      'CRA_PROJECT_FORBIDDEN',
    )
  }

  return assignment
}
