import { getRouterParam } from 'h3'

import { requireAuth } from '../../../utils/auth'

import {
  httpError,
  jsonSafe,
  requireRouterId,
  success,
} from '../../../utils/api'

import {
  requireExpenseManager,
} from '../../../utils/expenses'

import { prisma } from '../../../utils/prisma'
import { writeAuditLog } from '../../../utils/audit'

export default defineEventHandler(async (event) => {
  const context = await requireAuth(event)

  /*
   * Le règlement est une opération financière.
   * expense:review seul ne suffit donc pas.
   */
  requireExpenseManager(context)

  const id = requireRouterId(
    getRouterParam(event, 'id'),
    'Dépense',
  )

  const existing
    = await prisma.expense.findFirst({
      where: {
        id,
        associationId:
          context.associationId,
        archivedAt: null,
      },

      select: {
        id: true,
        status: true,
        projectId: true,
        intervenorId: true,
        reimbursable: true,
      },
    })

  if (!existing) {
    httpError(
      404,
      'Dépense introuvable.',
      'EXPENSE_NOT_FOUND',
    )
  }

  if (existing.status !== 'APPROVED') {
    httpError(
      409,
      'Seule une dépense approuvée peut être marquée comme payée.',
      'EXPENSE_NOT_PAYABLE',
    )
  }

  const paidAt = new Date()

  /*
   * Transition atomique APPROVED -> PAID.
   * Deux règlements concurrents ne peuvent donc pas
   * solder deux fois la même dépense.
   */
  const transition
    = await prisma.expense.updateMany({
      where: {
        id,
        associationId:
          context.associationId,
        archivedAt: null,
        status: 'APPROVED',
      },

      data: {
        status: 'PAID',
        paidAt,
        paidByUserId: context.userId,
      },
    })

  if (transition.count !== 1) {
    httpError(
      409,
      'La dépense a déjà été soldée ou son état a changé.',
      'EXPENSE_STATUS_CHANGED',
    )
  }

  const expense
    = await prisma.expense.findUniqueOrThrow({
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
        reviewedByUserId: true,
        rejectionReason: true,

        paidAt: true,
        paidByUserId: true,

        createdAt: true,
        updatedAt: true,
      },
    })

  const settlementKind
    = expense.reimbursable
      && expense.intervenorId
      ? 'INTERVENOR_REIMBURSEMENT'
      : 'ASSOCIATION_EXPENSE'

  await writeAuditLog(
    event,
    context,
    {
      action: 'EXPENSE_PAID',
      entityType: 'Expense',
      entityId: id,

      metadata: {
        previousStatus:
          'APPROVED',

        newStatus:
          'PAID',

        settlementKind,

        projectId:
          expense.projectId,

        intervenorId:
          expense.intervenorId,

        reimbursable:
          expense.reimbursable,

        paymentMethod:
          expense.paymentMethod,

        paidByUserId:
          expense.paidByUserId,

        amountInclTax:
          expense.amountInclTax
            .toString(),

        currency:
          expense.currency,
      },
    },
  )

  return success(
    jsonSafe(expense),
  )
})
