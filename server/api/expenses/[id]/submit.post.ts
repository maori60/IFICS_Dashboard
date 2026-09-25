import { getRouterParam } from 'h3'

import { requireAuth } from '../../../utils/auth'

import {
  httpError,
  jsonSafe,
  requireRouterId,
  success,
} from '../../../utils/api'

import {
  requireExpenseAccess,
  requireExpenseCreator,
} from '../../../utils/expenses'

import { prisma } from '../../../utils/prisma'
import { writeAuditLog } from '../../../utils/audit'
import { assertExpenseAccountingPeriodWritable } from '../../../utils/accounting-periods'

export default defineEventHandler(async (event) => {
  const context = await requireAuth(event)

  const id = requireRouterId(
    getRouterParam(event, 'id'),
    'Dépense',
  )

  const existing = await requireExpenseAccess(
    context,
    id,
  )

  // La lecture d'une dépense ne suffit pas pour la soumettre.
  // Il faut expense:manage ou expense:write:own.
  requireExpenseCreator(context)

  if (existing.status !== 'DRAFT') {
    httpError(
      409,
      'Seule une dépense en brouillon peut être soumise.',
      'EXPENSE_NOT_SUBMITTABLE',
    )
  }

  await assertExpenseAccountingPeriodWritable(
    context.associationId,
    id,
  )

  const submittedAt = new Date()

  /*
   * updateMany permet de rendre la transition atomique :
   * si le statut a changé entre la lecture et l'écriture,
   * aucune mise à jour n'est effectuée.
   */
  const transition = await prisma.expense.updateMany({
    where: {
      id,
      associationId: context.associationId,
      archivedAt: null,
      status: 'DRAFT',
    },

    data: {
      status: 'SUBMITTED',
      submittedAt,

      reviewedAt: null,
      reviewedByUserId: null,
      rejectionReason: null,
    },
  })

  if (transition.count !== 1) {
    httpError(
      409,
      'La dépense a changé d’état et ne peut plus être soumise.',
      'EXPENSE_STATUS_CHANGED',
    )
  }

  const expense = await prisma.expense.findUniqueOrThrow({
    where: {
      id,
    },

    select: {
      id: true,
      category: true,
      status: true,
      expenseDate: true,

      supplierName: true,
      description: true,
      reference: true,

      currency: true,
      amountExclTax: true,
      taxRate: true,
      taxAmount: true,
      amountInclTax: true,

      paymentMethod: true,
      reimbursable: true,

      projectId: true,
      intervenorId: true,

      submittedAt: true,
      reviewedAt: true,
      rejectionReason: true,

      createdAt: true,
      updatedAt: true,
    },
  })

  await writeAuditLog(
    event,
    context,
    {
      action: 'EXPENSE_SUBMITTED',
      entityType: 'Expense',
      entityId: id,

      metadata: {
        previousStatus: 'DRAFT',
        newStatus: 'SUBMITTED',
        projectId: expense.projectId,
        intervenorId: expense.intervenorId,
        amountInclTax:
          expense.amountInclTax.toString(),
        currency: expense.currency,
      },
    },
  )

  return success(
    jsonSafe(expense),
  )
})
