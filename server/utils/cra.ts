import { hasPermission, type AuthContext } from './auth'
import { httpError } from './api'
import { PERMISSIONS, ROLE_CODES } from './constants'
import { prisma } from './prisma'

export function requireCraWriter(context: AuthContext): string {
  const intervenorId = context.intervenorId

  if (
    context.roleCode === ROLE_CODES.CLIENT
    || !intervenorId
    || !hasPermission(context, PERMISSIONS.CRA_WRITE_OWN)
  ) {
    httpError(
      403,
      'La saisie des CRA nécessite une fiche intervenant liée et la permission de saisie personnelle.',
      'CRA_FORBIDDEN',
    )
  }

  return intervenorId
}

export async function requireCraAssignmentForCreation(
  context: AuthContext,
  projectId: string,
  intervenorId: string,
) {
  const ownIntervenorId = requireCraWriter(context)

  if (ownIntervenorId !== intervenorId) {
    httpError(
      403,
      'Vous pouvez uniquement créer, modifier et soumettre vos propres CRA.',
      'CRA_FORBIDDEN',
    )
  }

  const assignment = await prisma.projectIntervenor.findFirst({
    where: {
      projectId,
      intervenorId: ownIntervenorId,
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