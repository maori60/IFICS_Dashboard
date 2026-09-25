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
  requireExpenseAccess,
  requireExpenseCreator,
} from '../../../utils/expenses'

import { prisma } from '../../../utils/prisma'

import {
  optionalString,
  safeObject,
} from '../../../utils/validation'

import { writeAuditLog } from '../../../utils/audit'
import { assertExpenseAccountingPeriodWritable } from '../../../utils/accounting-periods'

export default defineEventHandler(async (event) => {
  const context = await requireAuth(event)

  const id = requireRouterId(
    getRouterParam(event, 'id'),
    'Dépense',
  )

  /*
   * requireExpenseAccess garantit :
   * - l'association courante ;
   * - la visibilité de la dépense ;
   * - le masquage 404 des dépenses d'un autre intervenant.
   */
  const existing = await requireExpenseAccess(
    context,
    id,
  )

  /*
   * null = utilisateur disposant de expense:manage.
   * string = intervenant disposant de expense:write:own.
   */
  const ownIntervenorId
    = requireExpenseCreator(context)

  const cancellableStatuses
    = ownIntervenorId === null
      ? [
          'DRAFT',
          'SUBMITTED',
          'REJECTED',
          'APPROVED',
        ] as const
      : [
          'DRAFT',
          'SUBMITTED',
          'REJECTED',
        ] as const

  if (
    !cancellableStatuses.includes(
      existing.status as never,
    )
  ) {
    httpError(
      409,
      'Cette dépense ne peut plus être annulée.',
      'EXPENSE_NOT_CANCELLABLE',
    )
  }

  await assertExpenseAccountingPeriodWritable(
    context.associationId,
    id,
  )

  const body = safeObject(
    await readBody(event),
  )

  const cancellationReason
    = optionalString(
      body.cancellationReason,
      'Motif de l’annulation',
      { max: 5_000 },
    )

  if (!cancellationReason) {
    httpError(
      400,
      'Le motif de l’annulation est obligatoire.',
      'EXPENSE_CANCELLATION_REASON_REQUIRED',
    )
  }

  const cancelledAt = new Date()

  /*
   * Transition atomique :
   * si le statut change entre la lecture et l'écriture,
   * aucune annulation concurrente ne peut écraser l'état.
   */
  const transition
    = await prisma.expense.updateMany({
      where: {
        id,
        associationId:
          context.associationId,
        archivedAt: null,

        ...(ownIntervenorId
          ? {
              intervenorId:
                ownIntervenorId,
            }
          : {}),

        status: {
          in: [...cancellableStatuses],
        },
      },

      data: {
        status: 'CANCELLED',
        cancelledAt,
        cancelledByUserId:
          context.userId,
        cancellationReason,
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

        paidAt: true,
        paidByUserId: true,

        cancelledAt: true,
        cancelledByUserId: true,
        cancellationReason: true,

        createdAt: true,
        updatedAt: true,
      },
    })

  await writeAuditLog(
    event,
    context,
    {
      action: 'EXPENSE_CANCELLED',
      entityType: 'Expense',
      entityId: id,

      metadata: {
        previousStatus:
          existing.status,

        newStatus:
          'CANCELLED',

        cancellationReason,

        cancelledByUserId:
          context.userId,

        projectId:
          expense.projectId,

        intervenorId:
          expense.intervenorId,

        reimbursable:
          expense.reimbursable,

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
