import { requireAuth } from '../../utils/auth'
import { success, jsonSafe } from '../../utils/api'
import { expenseVisibilityWhere } from '../../utils/expenses'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const context = await requireAuth(event)

  const expenses = await prisma.expense.findMany({
    where: expenseVisibilityWhere(context),
    orderBy: [
      { expenseDate: 'desc' },
      { createdAt: 'desc' },
    ],
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
      submittedAt: true,
      reviewedAt: true,
      paidAt: true,
      createdAt: true,
      updatedAt: true,

      project: {
        select: {
          id: true,
          reference: true,
          title: true,
        },
      },

      intervenor: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },

      createdByUser: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },

      _count: {
        select: {
          attachments: true,
        },
      },
    },
  })

  return success(jsonSafe(expenses))
})
