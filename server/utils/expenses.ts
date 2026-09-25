import type { Prisma } from '../../generated/prisma/client'
import { hasPermission, type AuthContext } from './auth'
import { httpError } from './api'
import { PERMISSIONS } from './constants'
import { prisma } from './prisma'

export function canReadAllExpenses(context: AuthContext): boolean {
  return (
    hasPermission(context, PERMISSIONS.EXPENSE_READ_ALL)
    || hasPermission(context, PERMISSIONS.EXPENSE_MANAGE)
  )
}

export function canManageExpenses(context: AuthContext): boolean {
  return hasPermission(context, PERMISSIONS.EXPENSE_MANAGE)
}

export function canReviewExpenses(context: AuthContext): boolean {
  return (
    hasPermission(context, PERMISSIONS.EXPENSE_REVIEW)
    || canManageExpenses(context)
  )
}

export function canExportExpenses(context: AuthContext): boolean {
  return (
    hasPermission(context, PERMISSIONS.EXPENSE_EXPORT)
    || canManageExpenses(context)
  )
}

export function requireExpenseReviewer(
  context: AuthContext,
): void {
  if (!canReviewExpenses(context)) {
    httpError(
      403,
      'Vous ne disposez pas de l’autorisation nécessaire pour valider les dépenses.',
      'EXPENSE_REVIEW_FORBIDDEN',
    )
  }
}

export function requireExpenseManager(
  context: AuthContext,
): void {
  if (!canManageExpenses(context)) {
    httpError(
      403,
      'Vous ne disposez pas de l’autorisation nécessaire pour solder les dépenses.',
      'EXPENSE_MANAGE_FORBIDDEN',
    )
  }
}

export function requireOwnExpenseWriter(context: AuthContext): string {
  if (
    !context.intervenorId
    || !hasPermission(context, PERMISSIONS.EXPENSE_WRITE_OWN)
  ) {
    httpError(
      403,
      'Vous ne disposez pas de l’autorisation nécessaire pour saisir des dépenses.',
      'EXPENSE_WRITE_FORBIDDEN',
    )
  }

  return context.intervenorId
}

export function requireExpenseCreator(
  context: AuthContext,
): string | null {
  if (canManageExpenses(context)) {
    return null
  }

  return requireOwnExpenseWriter(context)
}

/**
 * Limite l'accès aux dépenses rattachées à un projet classifié.
 *
 * Une dépense générale, sans projet, reste visible selon les
 * permissions Expense habituelles.
 *
 * CONFIDENTIAL et RESTRICTED nécessitent explicitement
 * project:confidential:read.
 */
export function expenseProjectVisibilityWhere(
  context: AuthContext,
): Prisma.ExpenseWhereInput {
  if (
    hasPermission(
      context,
      PERMISSIONS.PROJECT_CONFIDENTIAL_READ,
    )
  ) {
    return {}
  }

  return {
    OR: [
      {
        projectId: null,
      },
      {
        project: {
          is: {
            classification: {
              notIn: [
                'CONFIDENTIAL',
                'RESTRICTED',
              ],
            },
          },
        },
      },
    ],
  }
}

export function expenseVisibilityWhere(
  context: AuthContext,
): Prisma.ExpenseWhereInput {
  const projectVisibility
    = expenseProjectVisibilityWhere(
      context,
    )

  if (canReadAllExpenses(context)) {
    return {
      associationId: context.associationId,
      archivedAt: null,
      ...projectVisibility,
    }
  }

  if (
    context.intervenorId
    && hasPermission(
      context,
      PERMISSIONS.EXPENSE_READ_OWN,
    )
  ) {
    return {
      associationId: context.associationId,
      intervenorId: context.intervenorId,
      archivedAt: null,
      ...projectVisibility,
    }
  }

  httpError(
    403,
    'Vous ne disposez pas de l’autorisation nécessaire pour consulter les dépenses.',
    'EXPENSE_READ_FORBIDDEN',
  )
}

export async function requireExpenseAccess(
  context: AuthContext,
  expenseId: string,
) {
  const expense = await prisma.expense.findFirst({
    where: {
      id: expenseId,
      ...expenseVisibilityWhere(context),
    },
  })

  if (!expense) {
    httpError(
      404,
      'Dépense introuvable.',
      'EXPENSE_NOT_FOUND',
    )
  }

  return expense
}

/**
 * Accès ponctuel au workflow de revue.
 *
 * Un utilisateur disposant uniquement de expense:review
 * peut consulter une dépense SUBMITTED de son association
 * afin de prendre sa décision, sans obtenir pour autant
 * expense:read:all.
 *
 * Les droits de lecture habituels continuent de s'appliquer
 * pour tous les autres cas.
 */
export async function requireExpenseReviewReadAccess(
  context: AuthContext,
  expenseId: string,
) {
  if (
    !canReadAllExpenses(context)
    && canReviewExpenses(context)
  ) {
    const reviewable
      = await prisma.expense.findFirst({
        where: {
          id: expenseId,
          associationId:
            context.associationId,
          archivedAt: null,

          ...expenseProjectVisibilityWhere(
            context,
          ),

          status: 'SUBMITTED',
        },
      })

    if (reviewable) {
      return reviewable
    }

    /*
     * Un reviewer pur ne doit pas pouvoir distinguer
     * un brouillon, une dépense déjà traitée ou une
     * dépense appartenant à une autre association.
     */
    const canReadOwn
      = Boolean(
        context.intervenorId
        && hasPermission(
          context,
          PERMISSIONS.EXPENSE_READ_OWN,
        ),
      )

    if (!canReadOwn) {
      httpError(
        404,
        'Dépense introuvable.',
        'EXPENSE_NOT_FOUND',
      )
    }
  }

  return requireExpenseAccess(
    context,
    expenseId,
  )
}

export async function requireExpenseProject(
  context: AuthContext,
  projectId: string,
) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      associationId: context.associationId,
      archivedAt: null,
    },
    select: {
      id: true,
      status: true,
      classification: true,
    },
  })

  if (!project) {
    httpError(
      404,
      'Projet introuvable.',
      'EXPENSE_PROJECT_NOT_FOUND',
    )
  }

  if (
    ['CONFIDENTIAL', 'RESTRICTED'].includes(project.classification)
    && !hasPermission(context, PERMISSIONS.PROJECT_CONFIDENTIAL_READ)
  ) {
    httpError(
      403,
      'Ce projet nécessite une autorisation spécifique.',
      'EXPENSE_PROJECT_FORBIDDEN',
    )
  }

  return project
}

export async function requireExpenseIntervenor(
  context: AuthContext,
  intervenorId: string,
) {
  const intervenor = await prisma.intervenor.findFirst({
    where: {
      id: intervenorId,
      associationId: context.associationId,
      archivedAt: null,
    },
    select: {
      id: true,
      status: true,
    },
  })

  if (!intervenor) {
    httpError(
      404,
      'Intervenant introuvable.',
      'EXPENSE_INTERVENOR_NOT_FOUND',
    )
  }

  return intervenor
}

export async function requireExpenseProjectAssignment(
  context: AuthContext,
  projectId: string,
  intervenorId: string,
) {
  await requireExpenseProject(context, projectId)
  await requireExpenseIntervenor(context, intervenorId)

  const assignment = await prisma.projectIntervenor.findFirst({
    where: {
      projectId,
      intervenorId,
      assignmentStatus: 'ACCEPTED',
      project: {
        associationId: context.associationId,
        archivedAt: null,
      },
      intervenor: {
        associationId: context.associationId,
        archivedAt: null,
      },
    },
    select: {
      id: true,
      projectId: true,
      intervenorId: true,
    },
  })

  if (!assignment) {
    httpError(
      403,
      'Cet intervenant n’est pas affecté à ce projet.',
      'EXPENSE_PROJECT_ASSIGNMENT_REQUIRED',
    )
  }

  return assignment
}

export function assertExpenseEditableStatus(status: string): void {
  if (!['DRAFT', 'REJECTED'].includes(status)) {
    httpError(
      409,
      'Cette dépense n’est plus modifiable dans son état actuel.',
      'EXPENSE_NOT_EDITABLE',
    )
  }
}
