import {
  getRouterParam,
  readBody,
} from 'h3'

import { requireAuth } from '../../../utils/auth'

import {
  httpError,
  jsonSafe,
  requireRouterId,
  success,
} from '../../../utils/api'

import {
  expenseProjectVisibilityWhere,
  requireExpenseReviewer,
} from '../../../utils/expenses'

import { prisma } from '../../../utils/prisma'

import {
  optionalString,
  requiredEnum,
  safeObject,
} from '../../../utils/validation'

import { writeAuditLog } from '../../../utils/audit'
import { assertExpenseAccountingPeriodWritable } from '../../../utils/accounting-periods'

const DECISIONS = [
  'APPROVED',
  'REJECTED',
] as const

export default defineEventHandler(async (event) => {
  const context = await requireAuth(event)

  /*
   * La permission est contrôlée avant le body :
   * un utilisateur non autorisé reçoit toujours 403.
   */
  requireExpenseReviewer(context)

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

        ...expenseProjectVisibilityWhere(
          context,
        ),
      },

      select: {
        id: true,
        status: true,
        projectId: true,
        intervenorId: true,
      },
    })

  if (!existing) {
    httpError(
      404,
      'Dépense introuvable.',
      'EXPENSE_NOT_FOUND',
    )
  }

  if (existing.status !== 'SUBMITTED') {
    httpError(
      409,
      'Seule une dépense soumise peut être validée ou rejetée.',
      'EXPENSE_NOT_REVIEWABLE',
    )
  }

  await assertExpenseAccountingPeriodWritable(
    context.associationId,
    id,
  )

  const body = safeObject(
    await readBody(event),
  )

  const decision = requiredEnum(
    body.decision,
    DECISIONS,
    'Décision',
  )

  const rejectionReason
    = optionalString(
      body.rejectionReason,
      'Motif du rejet',
      { max: 5_000 },
    )

  if (
    decision === 'REJECTED'
    && !rejectionReason
  ) {
    httpError(
      400,
      'Le motif du rejet est obligatoire.',
      'EXPENSE_REJECTION_REASON_REQUIRED',
    )
  }

  const reviewedAt = new Date()

  /*
   * Transition atomique.
   *
   * Si un second administrateur traite la même dépense
   * entre la lecture et cette écriture, count sera 0.
   */
  const transition
    = await prisma.expense.updateMany({
      where: {
        id,
        associationId:
          context.associationId,
        archivedAt: null,

        ...expenseProjectVisibilityWhere(
          context,
        ),
        status: 'SUBMITTED',
      },

      data: {
        status: decision,

        reviewedAt,
        reviewedByUserId:
          context.userId,

        rejectionReason:
          decision === 'REJECTED'
            ? rejectionReason
            : null,
      },
    })

  if (transition.count !== 1) {
    httpError(
      409,
      'La dépense a déjà été traitée ou son état a changé.',
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

        createdAt: true,
        updatedAt: true,
      },
    })

  await writeAuditLog(
    event,
    context,
    {
      action:
        decision === 'APPROVED'
          ? 'EXPENSE_APPROVED'
          : 'EXPENSE_REJECTED',

      entityType: 'Expense',
      entityId: id,

      metadata: {
        previousStatus:
          'SUBMITTED',

        newStatus:
          decision,

        projectId:
          expense.projectId,

        intervenorId:
          expense.intervenorId,

        rejectionReason:
          decision === 'REJECTED'
            ? rejectionReason
            : null,

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
