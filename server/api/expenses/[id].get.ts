import { getRouterParam } from 'h3'
import { requireAuth } from '../../utils/auth'
import {
  jsonSafe,
  requireRouterId,
  success,
} from '../../utils/api'
import { requireExpenseReviewReadAccess } from '../../utils/expenses'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const context = await requireAuth(event)

  const id = requireRouterId(
    getRouterParam(event, 'id'),
    'Dépense',
  )

  await requireExpenseReviewReadAccess(
    context,
    id,
  )

  const expense = await prisma.expense.findUniqueOrThrow({
    where: { id },

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

      taxDeductibility: true,
      deductibleTaxAmount: true,
      taxDeductibleDate: true,
      taxReviewNote: true,
      taxReviewedAt: true,

      taxReviewedByUser: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },

      submittedAt: true,
      reviewedAt: true,
      paidAt: true,
      paidByUserId: true,
      cancelledAt: true,
      cancelledByUserId: true,
      rejectionReason: true,
      cancellationReason: true,

      createdAt: true,
      updatedAt: true,

      project: {
        select: {
          id: true,
          reference: true,
          title: true,
          status: true,
        },
      },

      intervenor: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },

      createdByUser: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },

      reviewedByUser: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },

      paidByUser: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },

      cancelledByUser: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },

      attachments: {
        orderBy: {
          createdAt: 'desc',
        },

        select: {
          id: true,
          originalName: true,
          mimeType: true,
          fileSize: true,
          sha256: true,
          createdAt: true,
        },
      },
    },
  })

  return success(jsonSafe(expense))
})
